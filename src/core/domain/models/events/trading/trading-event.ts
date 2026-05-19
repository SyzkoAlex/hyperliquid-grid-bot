import { EventType } from '../event-type';

export abstract class SerializableEvent {
    public readonly timestamp: number;

    constructor(
        public readonly eventType: EventType,
        public readonly userId: string,
        timestamp?: number,
    ) {
        this.timestamp = timestamp ?? Date.now();
    }

    serialize(): string {
        return JSON.stringify({
            eventType: this.eventType,
            userId: this.userId,
            timestamp: this.timestamp,
            ...this.toJSON(),
        });
    }

    protected abstract toJSON(): Record<string, any>;
}
