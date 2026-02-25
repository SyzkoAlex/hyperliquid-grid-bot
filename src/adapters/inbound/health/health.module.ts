import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthAdapter } from './health.adapter';

@Module({
    imports: [TerminusModule],
    controllers: [HealthAdapter],
})
export class HealthModule {}
