import { Injectable } from '@nestjs/common';
import { SerializableEvent } from '@domain/models/events/trading/trading-event';
import { EventType } from '@domain/models/events/event-type';
import { EventDeserializer } from '@domain/models/events/event-deserializer';
import { logger } from '@/infra/logger/logger';
import { EventBus } from '@/infra/events/event-bus.port';

type EventHandler<T extends SerializableEvent = SerializableEvent> = (
    event: T,
) => void | Promise<void>;

@Injectable()
export class EventBusAdapter implements EventBus {
    private readonly logger = logger.child({ context: EventBusAdapter.name });
    private handlers = new Map<string, EventHandler[]>();

    constructor(private readonly eventDeserializer: EventDeserializer) {}

    async publish(event: SerializableEvent): Promise<void> {
        const eventType = event.eventType;
        const eventJson = event.serialize();

        this.logger.debug({ eventType }, 'Publishing event');

        const handlers = this.handlers.get(eventType) || [];

        await Promise.all(
            handlers.map(async (handler) => {
                try {
                    const deserializedEvent = this.eventDeserializer.deserialize(
                        eventType,
                        eventJson,
                    );
                    await handler(deserializedEvent);
                } catch (error) {
                    this.logger.error({ error, eventType }, 'Error in event handler');
                }
            }),
        );
    }

    subscribe<T extends SerializableEvent = SerializableEvent>(
        eventType: EventType,
        handler: EventHandler<T>,
    ): () => void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }

        this.handlers.get(eventType)!.push(handler as EventHandler);

        this.logger.debug({ eventType }, 'Handler subscribed');

        return () => {
            const handlers = this.handlers.get(eventType) || [];
            const index = handlers.indexOf(handler as EventHandler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        };
    }

    getSubscriberCount(eventName: string): number {
        return this.handlers.get(eventName)?.length || 0;
    }

    clear(eventName?: string): void {
        if (eventName) {
            this.handlers.delete(eventName);
        } else {
            this.handlers.clear();
        }
    }
}
