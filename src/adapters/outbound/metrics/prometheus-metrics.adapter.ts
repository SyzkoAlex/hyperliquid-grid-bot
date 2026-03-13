import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { collectDefaultMetrics, Counter, Gauge, Histogram, register } from 'prom-client';
import { MetricsPort } from '@/core/application/ports/outbound/metrics.port';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class PrometheusMetricsAdapter implements MetricsPort, OnModuleInit {
    private readonly logger = logger.child({ context: PrometheusMetricsAdapter.name });

    private readonly ordersPlacedCounter: Counter;
    private readonly ordersFilledCounter: Counter;
    private readonly ordersCancelledCounter: Counter;
    private readonly gridStartedCounter: Counter;
    private readonly gridStoppedCounter: Counter;
    private readonly liquidationAlertsCounter: Counter;

    private readonly activeGridsGauge: Gauge;
    private readonly activeOrdersGauge: Gauge;
    private readonly currentPositionSizeGauge: Gauge;
    private readonly totalPnLGauge: Gauge;
    private readonly liquidationDistanceGauge: Gauge;
    private readonly marginRatioGauge: Gauge;

    private readonly orderExecutionTimeHistogram: Histogram;
    private readonly gridRebalanceTimeHistogram: Histogram;

    constructor(private readonly configService: ConfigService<Config, true>) {
        this.ordersPlacedCounter = new Counter({
            name: 'grid_bot_orders_placed_total',
            help: 'Total number of orders placed',
            labelNames: ['symbol', 'side'],
        });

        this.ordersFilledCounter = new Counter({
            name: 'grid_bot_orders_filled_total',
            help: 'Total number of orders filled',
            labelNames: ['symbol', 'side'],
        });

        this.ordersCancelledCounter = new Counter({
            name: 'grid_bot_orders_cancelled_total',
            help: 'Total number of orders cancelled',
            labelNames: ['symbol'],
        });

        this.gridStartedCounter = new Counter({
            name: 'grid_bot_grids_started_total',
            help: 'Total number of grids started',
            labelNames: ['symbol', 'mode'],
        });

        this.gridStoppedCounter = new Counter({
            name: 'grid_bot_grids_stopped_total',
            help: 'Total number of grids stopped',
            labelNames: ['symbol', 'reason'],
        });

        this.liquidationAlertsCounter = new Counter({
            name: 'grid_bot_liquidation_alerts_total',
            help: 'Total number of liquidation alerts',
            labelNames: ['level'],
        });

        this.activeGridsGauge = new Gauge({
            name: 'grid_bot_active_grids',
            help: 'Number of active grids',
        });

        this.activeOrdersGauge = new Gauge({
            name: 'grid_bot_active_orders',
            help: 'Number of active orders',
            labelNames: ['symbol'],
        });

        this.currentPositionSizeGauge = new Gauge({
            name: 'grid_bot_position_size',
            help: 'Current position size',
            labelNames: ['symbol'],
        });

        this.totalPnLGauge = new Gauge({
            name: 'grid_bot_total_pnl',
            help: 'Total PnL (realized + unrealized)',
            labelNames: ['symbol'],
        });

        this.liquidationDistanceGauge = new Gauge({
            name: 'grid_bot_liquidation_distance_percent',
            help: 'Distance to liquidation in percent',
            labelNames: ['symbol'],
        });

        this.marginRatioGauge = new Gauge({
            name: 'grid_bot_margin_ratio',
            help: 'Current margin ratio',
        });

        this.orderExecutionTimeHistogram = new Histogram({
            name: 'grid_bot_order_execution_duration_seconds',
            help: 'Order execution duration in seconds',
            buckets: [0.1, 0.5, 1, 2, 5],
        });

        this.gridRebalanceTimeHistogram = new Histogram({
            name: 'grid_bot_rebalance_duration_seconds',
            help: 'Grid rebalance duration in seconds',
            buckets: [0.5, 1, 2, 5, 10],
        });
    }

    onModuleInit() {
        const { enabled } = this.configService.get('metrics', { infer: true });

        if (enabled) {
            collectDefaultMetrics({ register });
            this.logger.info('Prometheus metrics enabled');
        } else {
            this.logger.info('Prometheus metrics disabled');
        }
    }

    recordOrderPlaced(symbol: string, side: string): void {
        this.ordersPlacedCounter.inc({ symbol, side });
    }

    recordOrderFilled(symbol: string, side: string): void {
        this.ordersFilledCounter.inc({ symbol, side });
    }

    recordOrderCancelled(symbol: string): void {
        this.ordersCancelledCounter.inc({ symbol });
    }

    recordGridStarted(symbol: string, mode: string): void {
        this.gridStartedCounter.inc({ symbol, mode });
    }

    recordGridStopped(symbol: string, reason: string): void {
        this.gridStoppedCounter.inc({ symbol, reason });
    }

    recordLiquidationAlert(level: string): void {
        this.liquidationAlertsCounter.inc({ level });
    }

    setActiveGrids(count: number): void {
        this.activeGridsGauge.set(count);
    }

    setActiveOrders(symbol: string, count: number): void {
        this.activeOrdersGauge.set({ symbol }, count);
    }

    setPositionSize(symbol: string, size: number): void {
        this.currentPositionSizeGauge.set({ symbol }, size);
    }

    setTotalPnL(symbol: string, pnl: number): void {
        this.totalPnLGauge.set({ symbol }, pnl);
    }

    setLiquidationDistance(symbol: string, percent: number): void {
        this.liquidationDistanceGauge.set({ symbol }, percent);
    }

    setMarginRatio(ratio: number): void {
        this.marginRatioGauge.set(ratio);
    }

    observeOrderExecutionTime(durationSeconds: number): void {
        this.orderExecutionTimeHistogram.observe(durationSeconds);
    }

    observeGridRebalanceTime(durationSeconds: number): void {
        this.gridRebalanceTimeHistogram.observe(durationSeconds);
    }
}
