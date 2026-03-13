import { Module } from '@nestjs/common';
import { InProcessEventBusModule } from '@/infra/events/in-process-event-bus.module';
import { EventPublisherAdapter } from './event-publisher.adapter';
import { EVENT_PUBLISHER_PORT } from '@/core/application/ports/outbound/event-publisher.port';

@Module({
    imports: [InProcessEventBusModule],
    providers: [{ provide: EVENT_PUBLISHER_PORT, useClass: EventPublisherAdapter }],
    exports: [EVENT_PUBLISHER_PORT],
})
export class EventPublisherModule {}
