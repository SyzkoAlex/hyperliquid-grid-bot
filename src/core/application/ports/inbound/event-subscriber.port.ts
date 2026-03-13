import { SerializableEvent } from '@domain/models/events/trading/trading-event';
import { EventType } from '@domain/models/events/event-type';

export const EVENT_SUBSCRIBER_PORT = Symbol('EVENT_SUBSCRIBER_PORT');

export interface EventSubscriberPort {
    subscribe<T extends SerializableEvent>(
        eventType: EventType,
        handler: (event: T) => void | Promise<void>,
    ): () => void;
}
