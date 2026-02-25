import { Injectable } from '@nestjs/common';
import { InProcessEventBus } from '@/infra/events/in-process-event-bus';
import { EventSubscriberPort } from '@/core/application/ports/inbound/event-subscriber.port';
import { SerializableEvent } from '@domain/models/events/trading/trading-event';
import { EventType } from '@domain/models/events/event-type';

@Injectable()
export class EventSubscriberAdapter implements EventSubscriberPort {
    constructor(private readonly bus: InProcessEventBus) {}

    subscribe<T extends SerializableEvent>(
        eventType: EventType,
        handler: (event: T) => void | Promise<void>,
    ): () => void {
        return this.bus.on(eventType, handler);
    }
}
