import { Module } from '@nestjs/common';
import { PrometheusMetricsModule } from '@adapters/outbound/metrics/prometheus-metrics.module';
import { MetricsAdapter } from './metrics.adapter';

@Module({
    imports: [PrometheusMetricsModule],
    controllers: [MetricsAdapter],
})
export class MetricsModule {}
