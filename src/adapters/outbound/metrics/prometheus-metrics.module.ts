import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrometheusMetricsAdapter } from './prometheus-metrics.adapter';
import { METRICS_PORT } from '@/core/application/ports/outbound/metrics.port';

@Module({
    imports: [ConfigModule],
    providers: [
        PrometheusMetricsAdapter,
        { provide: METRICS_PORT, useExisting: PrometheusMetricsAdapter },
    ],
    exports: [METRICS_PORT, PrometheusMetricsAdapter],
})
export class PrometheusMetricsModule {}
