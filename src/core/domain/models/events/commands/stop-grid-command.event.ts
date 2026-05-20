import { SerializableEvent } from '../trading/trading-event';
import { EventType } from '../event-type';

export class StopGridCommandEvent extends SerializableEvent {
    constructor(
        userId: string,
        public readonly gridId: string,
        public readonly accountAddress: string,
        timestamp?: number,
    ) {
        super(EventType.StopGridCommand, userId, timestamp);
    }

    static create(userId: string, gridId: string, accountAddress: string): StopGridCommandEvent {
        return new StopGridCommandEvent(userId, gridId, accountAddress);
    }

    protected toJSON(): Record<string, unknown> {
        return { gridId: this.gridId, accountAddress: this.accountAddress };
    }

    static deserialize(json: string): StopGridCommandEvent {
        const data = JSON.parse(json);
        return new StopGridCommandEvent(
            data.userId,
            data.gridId,
            data.accountAddress,
            data.timestamp,
        );
    }
}
