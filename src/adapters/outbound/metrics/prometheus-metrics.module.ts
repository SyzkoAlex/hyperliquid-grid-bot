import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrometheusMetricsAdapter } from './prometheus-metrics.adapter';
import { METRICS_PORT } from '@/core/application/ports/outbound/metrics.port';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [{ provide: METRICS_PORT, useClass: PrometheusMetricsAdapter }],
    exports: [METRICS_PORT],
})
export class PrometheusMetricsModule {}
