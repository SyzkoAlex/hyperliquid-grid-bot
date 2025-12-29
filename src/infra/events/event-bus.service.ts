import { Injectable } from '@nestjs/common';
import { logger } from '../logger/logger';

type EventHandler = (event: any) => void | Promise<void>;

/**
 * Simple Event Bus for inter-component communication
 * Allows components to communicate without direct dependencies
 */
@Injectable()
export class EventBus {
    private readonly logger = logger.child({ context: EventBus.name });
    private handlers = new Map<string, EventHandler[]>();

    /**
     * Publish an event
     */
    publish(event: any): void {
        const eventName = event.constructor.name;

        this.logger.debug({ eventName }, 'Publishing event');

        const handlers = this.handlers.get(eventName) || [];

        for (const handler of handlers) {
            try {
                const result = handler(event);
                if (result instanceof Promise) {
                    result.catch((error) => {
                        this.logger.error({ error, eventName }, 'Error in async event handler');
                    });
                }
            } catch (error) {
                this.logger.error({ error, eventName }, 'Error in sync event handler');
            }
        }
    }

    /**
     * Subscribe to an event
     */
    subscribe(eventName: string, handler: EventHandler): () => void {
        if (!this.handlers.has(eventName)) {
            this.handlers.set(eventName, []);
        }

        this.handlers.get(eventName)!.push(handler);

        this.logger.debug({ eventName }, 'Handler subscribed');

        // Return unsubscribe function
        return () => {
            const handlers = this.handlers.get(eventName) || [];
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        };
    }

    /**
     * Subscribe using decorator syntax
     */
    on(_eventName: string): MethodDecorator {
        return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
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
