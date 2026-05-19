import { SerializableEvent } from './trading-event';
import { EventType } from '../event-type';

export class GridCreatedErrorEvent extends SerializableEvent {
    constructor(
        public readonly error: string,
        public readonly accountAddress: string,
        timestamp?: number,
    ) {
        super(EventType.GridCreatedError, timestamp);
    }

    protected toJSON(): Record<string, any> {
        return {
            error: this.error,
            accountAddress: this.accountAddress,
        };
    }

    static deserialize(json: string): GridCreatedErrorEvent {
        const data = JSON.parse(json);
        return new GridCreatedErrorEvent(data.error, data.accountAddress, data.timestamp);
    }
}
