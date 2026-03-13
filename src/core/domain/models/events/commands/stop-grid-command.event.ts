import { SerializableEvent } from '../trading/trading-event';
import { EventType } from '../event-type';

export class StopGridCommandEvent extends SerializableEvent {
    constructor(
        public readonly gridId: string,
        timestamp?: number,
    ) {
        super(EventType.StopGridCommand, timestamp);
    }

    static create(gridId: string): StopGridCommandEvent {
        return new StopGridCommandEvent(gridId);
    }

    protected toJSON(): Record<string, any> {
        return { gridId: this.gridId };
    }

    static deserialize(json: string): StopGridCommandEvent {
        const data = JSON.parse(json);
        return new StopGridCommandEvent(data.gridId, data.timestamp);
    }
}
