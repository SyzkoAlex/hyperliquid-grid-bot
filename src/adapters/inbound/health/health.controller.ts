import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
    constructor(private health: HealthCheckService) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([]);
    }

    @Get('ready')
    @HealthCheck()
    ready() {
        return this.health.check([]);
    }

    @Get('live')
    @HealthCheck()
    live() {
        return { status: 'ok', timestamp: new Date().toISOString() };
    }
}
