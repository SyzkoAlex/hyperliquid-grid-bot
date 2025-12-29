import { Module } from '@nestjs/common';
import { PrometheusService } from './prometheus.service';
import { MetricsController } from './metrics.controller';

@Module({
    providers: [PrometheusService],
    controllers: [MetricsController],
    exports: [PrometheusService],
})
export class MetricsModule {}
