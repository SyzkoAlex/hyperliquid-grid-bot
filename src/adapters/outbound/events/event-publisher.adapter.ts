import { Injectable } from '@nestjs/common';
import { InProcessEventBus } from '@/infra/events/in-process-event-bus';
import { EventPublisherPort } from '@/core/application/ports/outbound/event-publisher.port';
import { SerializableEvent } from '@domain/models/events/trading/trading-event';

@Injectable()
export class EventPublisherAdapter implements EventPublisherPort {
    constructor(private readonly bus: InProcessEventBus) {}

    publish(event: SerializableEvent): Promise<void> {
        return this.bus.emit(event.eventType, event);
    }
}
