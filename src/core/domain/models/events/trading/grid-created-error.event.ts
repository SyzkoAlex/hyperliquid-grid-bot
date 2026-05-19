import { SerializableEvent } from './trading-event';
import { EventType } from '../event-type';

export class GridCreatedErrorEvent extends SerializableEvent {
    constructor(
        public readonly userId: string,
        public readonly error: string,
        timestamp?: number,
    ) {
        super(EventType.GridCreatedError, userId, timestamp);
    }

    protected toJSON(): Record<string, any> {
        return {
            error: this.error,
        };
    }

    static deserialize(json: string): GridCreatedErrorEvent {
        const data = JSON.parse(json);
        return new GridCreatedErrorEvent(data.userId, data.error, data.timestamp);
    }
}
