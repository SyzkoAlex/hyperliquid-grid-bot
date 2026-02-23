import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { register, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class PrometheusService implements OnModuleInit {
    private readonly logger = logger.child({ context: PrometheusService.name });

    // Counters
    public readonly ordersPlacedCounter: Counter;
    public readonly ordersFilledCounter: Counter;
    public readonly ordersCancelledCounter: Counter;
    public readonly gridStartedCounter: Counter;
    public readonly gridStoppedCounter: Counter;
    public readonly liquidationAlertsCounter: Counter;

    // Gauges
    public readonly activeGridsGauge: Gauge;
    public readonly activeOrdersGauge: Gauge;
    public readonly currentPositionSizeGauge: Gauge;
    public readonly totalPnLGauge: Gauge;
    public readonly liquidationDistanceGauge: Gauge;
    public readonly marginRatioGauge: Gauge;

    // Histograms
    public readonly orderExecutionTimeHistogram: Histogram;
    public readonly gridRebalanceTimeHistogram: Histogram;

    constructor(private readonly configService: ConfigService) {
        // Counters
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

        // Gauges
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

        // Histograms
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
        const enabled = this.configService.get<boolean>('METRICS_ENABLED', true);

        if (enabled) {
            // Collect default metrics (CPU, memory, etc.)
            collectDefaultMetrics({ register });
            this.logger.info('Prometheus metrics enabled');
        } else {
            this.logger.info('Prometheus metrics disabled');
        }
    }

    getMetrics(): Promise<string> {
        return register.metrics();
    }

    getContentType(): string {
        return register.contentType;
    }
}
