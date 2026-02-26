import { Module } from '@nestjs/common';
import { InProcessEventBusModule } from '@/infra/events/in-process-event-bus.module';
import { EventSubscriberAdapter } from './event-subscriber.adapter';
import { EVENT_SUBSCRIBER_PORT } from '@/core/application/ports/inbound/event-subscriber.port';

@Module({
    imports: [InProcessEventBusModule],
    providers: [{ provide: EVENT_SUBSCRIBER_PORT, useClass: EventSubscriberAdapter }],
    exports: [EVENT_SUBSCRIBER_PORT],
})
export class EventSubscriberModule {}
