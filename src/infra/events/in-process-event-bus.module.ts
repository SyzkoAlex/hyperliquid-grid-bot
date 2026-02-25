import { Module } from '@nestjs/common';
import { InProcessEventBus } from './in-process-event-bus';

@Module({
    providers: [InProcessEventBus],
    exports: [InProcessEventBus],
})
export class InProcessEventBusModule {}
