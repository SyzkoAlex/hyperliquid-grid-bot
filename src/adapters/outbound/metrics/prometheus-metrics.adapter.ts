import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { collectDefaultMetrics, Histogram, register } from 'prom-client';
import { MetricsPort } from '@/core/application/ports/outbound/metrics.port';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class PrometheusMetricsAdapter implements MetricsPort, OnModuleInit {
    private readonly logger = logger.child({ context: PrometheusMetricsAdapter.name });

    private exchangeApiDuration: Histogram | null = null;
    private telegramHandlerDuration: Histogram | null = null;

    constructor(private readonly configService: ConfigService<Config, true>) {}

    onModuleInit() {
        const { enabled } = this.configService.get('metrics', { infer: true });

        if (enabled) {
            this.exchangeApiDuration = new Histogram({
                name: 'grid_bot_exchange_api_duration_seconds',
                help: 'Hyperliquid exchange API call duration in seconds',
                labelNames: ['method'],
                buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
            });

            this.telegramHandlerDuration = new Histogram({
                name: 'grid_bot_telegram_handler_duration_seconds',
                help: 'Telegram handler execution duration in seconds',
                labelNames: ['handler'],
                buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
            });

            collectDefaultMetrics({ register });
            this.logger.info('Prometheus metrics enabled');
        } else {
            this.logger.info('Prometheus metrics disabled');
        }
    }

    observeExchangeApiDuration(method: string, durationSeconds: number): void {
        this.exchangeApiDuration?.observe({ method }, durationSeconds);
    }

    observeTelegramHandlerDuration(handler: string, durationSeconds: number): void {
        this.telegramHandlerDuration?.observe({ handler }, durationSeconds);
    }
}
