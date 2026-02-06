import { Injectable } from '@nestjs/common';
import { SerializableEvent } from '@domain/events/trading/trading-event';
import { EventType } from '@domain/events/event-type';
import { EventDeserializerService } from './event-deserializer.service';
import { logger } from '../logger/logger';
import { IEventBus } from './event-bus.interface';

type EventHandler<T extends SerializableEvent = SerializableEvent> = (
    event: T,
) => void | Promise<void>;

/**
 * Local in-memory event bus implementation.
 *
 * TODO: Migrate to external queue system (Kafka/NATS)
 * This implementation is ready for migration:
 * - All events are serializable (SerializableEvent with serialize/deserialize)
 * - Interface is async (returns Promise<void>)
 * - EventDeserializerService handles deserialization by EventType
 * - Just need to replace in-memory Map with external queue adapter
 */
@Injectable()
export class EventBus implements IEventBus {
    private readonly logger = logger.child({ context: EventBus.name });
    private handlers = new Map<string, EventHandler[]>();

    constructor(private readonly eventDeserializer: EventDeserializerService) {}

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

    /**
     * Subscribe to an event
     */
    subscribe<T extends SerializableEvent = SerializableEvent>(
        eventType: EventType,
        handler: EventHandler<T>,
    ): () => void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }

        this.handlers.get(eventType)!.push(handler as EventHandler);

        this.logger.debug({ eventType }, 'Handler subscribed');

        // Return unsubscribe function
        return () => {
            const handlers = this.handlers.get(eventType) || [];
            const index = handlers.indexOf(handler as EventHandler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        };
    }

    on(_eventName: string): MethodDecorator {
        return (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
            const originalMethod = descriptor.value;

            descriptor.value = function (...args: any[]) {
                return originalMethod.apply(this, args);
            };

            return descriptor;
        };
    }

    /**
     * Get subscriber count for an event
     */
    getSubscriberCount(eventName: string): number {
        return this.handlers.get(eventName)?.length || 0;
    }

    /**
     * Clear all handlers for an event
     */
    clear(eventName?: string): void {
        if (eventName) {
            this.handlers.delete(eventName);
        } else {
            this.handlers.clear();
        }
    }
}
