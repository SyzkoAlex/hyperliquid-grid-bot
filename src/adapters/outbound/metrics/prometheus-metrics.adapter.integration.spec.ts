import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { register } from 'prom-client';
import { PrometheusMetricsAdapter } from './prometheus-metrics.adapter';
import { METRICS_PORT, MetricsPort } from '@/core/application/ports/outbound/metrics.port';

describe('PrometheusMetricsAdapter (Integration)', () => {
    let module: TestingModule;
    let metrics: MetricsPort;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                {
                    provide: METRICS_PORT,
                    useClass: PrometheusMetricsAdapter,
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: (key: string) => {
                            if (key === 'metrics') {
                                return { enabled: false, port: 9090, path: '/metrics' };
                            }
                        },
                    },
                },
            ],
        }).compile();

        await module.init();
        metrics = module.get<MetricsPort>(METRICS_PORT);
    });

    afterEach(() => {
        register.resetMetrics();
    });

    afterAll(async () => {
        register.clear();
        await module.close();
    });

    async function getMetricValue(name: string, labels?: Record<string, string>): Promise<number> {
        const metric = await register.getSingleMetric(name)?.get();
        if (!metric) return 0;

        const value = labels
            ? metric.values.find((v) =>
                  Object.entries(labels).every(([k, val]) => v.labels[k] === val),
              )
            : metric.values[0];

        return value?.value ?? 0;
    }

    describe('Counters', () => {
        it('should increment orders placed counter', async () => {
            metrics.recordOrderPlaced('BTC', 'buy');
            metrics.recordOrderPlaced('BTC', 'buy');
            metrics.recordOrderPlaced('BTC', 'sell');

            expect(
                await getMetricValue('grid_bot_orders_placed_total', {
                    symbol: 'BTC',
                    side: 'buy',
                }),
            ).toBe(2);
            expect(
                await getMetricValue('grid_bot_orders_placed_total', {
                    symbol: 'BTC',
                    side: 'sell',
                }),
            ).toBe(1);
        });

        it('should increment orders filled counter', async () => {
            metrics.recordOrderFilled('ETH', 'buy');

            expect(
                await getMetricValue('grid_bot_orders_filled_total', {
                    symbol: 'ETH',
                    side: 'buy',
                }),
            ).toBe(1);
        });

        it('should increment orders cancelled counter', async () => {
            metrics.recordOrderCancelled('SOL');
            metrics.recordOrderCancelled('SOL');

            expect(await getMetricValue('grid_bot_orders_cancelled_total', { symbol: 'SOL' })).toBe(
                2,
            );
        });

        it('should increment grid started counter', async () => {
            metrics.recordGridStarted('BTC', 'long');

            expect(
                await getMetricValue('grid_bot_grids_started_total', {
                    symbol: 'BTC',
                    mode: 'long',
                }),
            ).toBe(1);
        });

        it('should increment grid stopped counter', async () => {
            metrics.recordGridStopped('BTC', 'manual');

            expect(
                await getMetricValue('grid_bot_grids_stopped_total', {
                    symbol: 'BTC',
                    reason: 'manual',
                }),
            ).toBe(1);
        });

        it('should increment liquidation alerts counter', async () => {
            metrics.recordLiquidationAlert('warning');
            metrics.recordLiquidationAlert('critical');
            metrics.recordLiquidationAlert('warning');

            expect(
                await getMetricValue('grid_bot_liquidation_alerts_total', { level: 'warning' }),
            ).toBe(2);
            expect(
                await getMetricValue('grid_bot_liquidation_alerts_total', { level: 'critical' }),
            ).toBe(1);
        });
    });

    describe('Gauges', () => {
        it('should set active grids gauge', async () => {
            metrics.setActiveGrids(5);
            expect(await getMetricValue('grid_bot_active_grids')).toBe(5);

            metrics.setActiveGrids(3);
            expect(await getMetricValue('grid_bot_active_grids')).toBe(3);
        });

        it('should set active orders gauge per symbol', async () => {
            metrics.setActiveOrders('BTC', 10);
            metrics.setActiveOrders('ETH', 6);

            expect(await getMetricValue('grid_bot_active_orders', { symbol: 'BTC' })).toBe(10);
            expect(await getMetricValue('grid_bot_active_orders', { symbol: 'ETH' })).toBe(6);
        });

        it('should set position size gauge', async () => {
            metrics.setPositionSize('BTC', 1.5);
            expect(await getMetricValue('grid_bot_position_size', { symbol: 'BTC' })).toBe(1.5);
        });

        it('should set total PnL gauge', async () => {
            metrics.setTotalPnL('BTC', -42.5);
            expect(await getMetricValue('grid_bot_total_pnl', { symbol: 'BTC' })).toBe(-42.5);
        });

        it('should set liquidation distance gauge', async () => {
            metrics.setLiquidationDistance('BTC', 25.3);
            expect(
                await getMetricValue('grid_bot_liquidation_distance_percent', { symbol: 'BTC' }),
            ).toBe(25.3);
        });

        it('should set margin ratio gauge', async () => {
            metrics.setMarginRatio(0.75);
            expect(await getMetricValue('grid_bot_margin_ratio')).toBe(0.75);
        });
    });

    describe('Histograms', () => {
        it('should observe order execution time', async () => {
            metrics.observeOrderExecutionTime(0.3);
            metrics.observeOrderExecutionTime(1.2);

            const metric = await register
                .getSingleMetric('grid_bot_order_execution_duration_seconds')
                ?.get();
            const values = metric?.values as Array<{ metricName?: string; value: number }>;
            const sum = values?.find((v) => v.metricName?.endsWith('_sum'));
            const count = values?.find((v) => v.metricName?.endsWith('_count'));

            expect(sum?.value).toBeCloseTo(1.5, 5);
            expect(count?.value).toBe(2);
        });

        it('should observe grid rebalance time', async () => {
            metrics.observeGridRebalanceTime(2.0);

            const metric = await register
                .getSingleMetric('grid_bot_rebalance_duration_seconds')
                ?.get();
            const values = metric?.values as Array<{ metricName?: string; value: number }>;
            const sum = values?.find((v) => v.metricName?.endsWith('_sum'));
            const count = values?.find((v) => v.metricName?.endsWith('_count'));

            expect(sum?.value).toBeCloseTo(2.0, 5);
            expect(count?.value).toBe(1);
        });
    });
});
