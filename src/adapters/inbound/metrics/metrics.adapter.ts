import { Controller, Get, Header } from '@nestjs/common';
import { register } from 'prom-client';

@Controller('metrics')
export class MetricsAdapter {
    @Get()
    @Header('Content-Type', 'text/plain')
    getMetrics(): Promise<string> {
        return register.metrics();
    }
}
