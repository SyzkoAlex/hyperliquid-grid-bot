import { SerializableEvent } from '../trading/trading-event';
import { EventType } from '../event-type';

export class StopGridCommandEvent extends SerializableEvent {
    constructor(
        public readonly gridId: string,
        public readonly accountAddress: string,
        timestamp?: number,
    ) {
        super(EventType.StopGridCommand, timestamp);
    }

    static create(gridId: string, accountAddress: string): StopGridCommandEvent {
        return new StopGridCommandEvent(gridId, accountAddress);
    }

    protected toJSON(): Record<string, unknown> {
        return { gridId: this.gridId, accountAddress: this.accountAddress };
    }

    static deserialize(json: string): StopGridCommandEvent {
        const data = JSON.parse(json);
        return new StopGridCommandEvent(data.gridId, data.accountAddress, data.timestamp);
    }
}
