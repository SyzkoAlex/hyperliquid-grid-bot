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

    async function getHistogramValues(
        name: string,
        labels?: Record<string, string>,
    ): Promise<{ sum: number; count: number }> {
        const metric = await register.getSingleMetric(name)?.get();
        if (!metric) return { sum: 0, count: 0 };

        const values = metric.values as Array<{
            metricName?: string;
            labels: Record<string, string>;
            value: number;
        }>;

        const matchesLabels = (v: { labels: Record<string, string> }) =>
            !labels || Object.entries(labels).every(([k, val]) => v.labels[k] === val);

        const sum =
            values.find((v) => v.metricName?.endsWith('_sum') && matchesLabels(v))?.value ?? 0;
        const count =
            values.find((v) => v.metricName?.endsWith('_count') && matchesLabels(v))?.value ?? 0;

        return { sum, count };
    }

    describe('observeExchangeApiDuration', () => {
        it('should record exchange API call duration', async () => {
            metrics.observeExchangeApiDuration('placeSpotOrder', 0.35);
            metrics.observeExchangeApiDuration('placeSpotOrder', 1.2);
            metrics.observeExchangeApiDuration('getCurrentPrice', 0.08);

            const placeOrder = await getHistogramValues('grid_bot_exchange_api_duration_seconds', {
                method: 'placeSpotOrder',
            });
            expect(placeOrder.count).toBe(2);
            expect(placeOrder.sum).toBeCloseTo(1.55, 5);

            const getPrice = await getHistogramValues('grid_bot_exchange_api_duration_seconds', {
                method: 'getCurrentPrice',
            });
            expect(getPrice.count).toBe(1);
            expect(getPrice.sum).toBeCloseTo(0.08, 5);
        });
    });

    describe('observeTelegramHandlerDuration', () => {
        it('should record telegram handler duration', async () => {
            metrics.observeTelegramHandlerDuration('show:balance', 0.5);
            metrics.observeTelegramHandlerDuration('view:grid', 1.8);

            const balance = await getHistogramValues('grid_bot_telegram_handler_duration_seconds', {
                handler: 'show:balance',
            });
            expect(balance.count).toBe(1);
            expect(balance.sum).toBeCloseTo(0.5, 5);

            const viewGrid = await getHistogramValues(
                'grid_bot_telegram_handler_duration_seconds',
                { handler: 'view:grid' },
            );
            expect(viewGrid.count).toBe(1);
            expect(viewGrid.sum).toBeCloseTo(1.8, 5);
        });
    });
});
