import { SerializableEvent } from '@domain/models/events/trading/trading-event';

export const EVENT_PUBLISHER_PORT = Symbol('EVENT_PUBLISHER_PORT');

export interface EventPublisherPort {
    publish(event: SerializableEvent): Promise<void>;
}
