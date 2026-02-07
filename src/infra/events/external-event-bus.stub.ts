import { Injectable } from '@nestjs/common';
import { SerializableEvent } from '@domain/events/trading/trading-event';
import { EventType } from '@domain/events/event-type';
import { logger } from '../logger/logger';
import { EventBus } from './event-bus.port';

type EventHandler<T extends SerializableEvent = SerializableEvent> = (
    event: T,
) => void | Promise<void>;

@Injectable()
export class ExternalEventBusStub implements EventBus {
    private readonly logger = logger.child({ context: ExternalEventBusStub.name });

    constructor() {
        this.logger.warn('Using ExternalEventBusStub — Kafka/NATS not implemented yet');
    }

    async publish(event: SerializableEvent): Promise<void> {
        this.logger.warn(
            { eventType: event.eventType },
            'publish() called but external event bus is not implemented',
        );
    }

    subscribe<T extends SerializableEvent = SerializableEvent>(
        eventType: EventType,
        _handler: EventHandler<T>,
    ): () => void {
        this.logger.warn(
            { eventType },
            'subscribe() called but external event bus is not implemented',
        );
        return () => {};
    }

    getSubscriberCount(_eventType: string): number {
        return 0;
    }

    clear(_eventType?: string): void {}
}
