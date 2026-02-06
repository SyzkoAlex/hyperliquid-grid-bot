import { SerializableEvent } from '@domain/events/trading/trading-event';
import { EventType } from '@domain/events/event-type';

type EventHandler<T extends SerializableEvent = SerializableEvent> = (
    event: T,
) => void | Promise<void>;

export interface IEventBus {
    publish(event: SerializableEvent): Promise<void>;
    subscribe<T extends SerializableEvent = SerializableEvent>(
        eventType: EventType,
        handler: EventHandler<T>,
    ): () => void;
    getSubscriberCount(eventType: string): number;
    clear(eventType?: string): void;
}
