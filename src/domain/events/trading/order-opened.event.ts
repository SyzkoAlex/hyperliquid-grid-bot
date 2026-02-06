import { SerializableEvent } from './trading-event';
import { EventType } from '../event-type';

export class OrderOpenedEvent extends SerializableEvent {
    constructor(
        public readonly gridId: string,
        public readonly symbol: string,
        public readonly side: string,
        public readonly price: number,
        public readonly amount: number,
        public readonly total: number,
        public readonly level: number,
        public readonly totalLevels: number,
        timestamp?: number,
    ) {
        super(EventType.OrderOpened, timestamp);
    }

    protected toJSON(): Record<string, any> {
        return {
            gridId: this.gridId,
            symbol: this.symbol,
            side: this.side,
            price: this.price,
            amount: this.amount,
            total: this.total,
            level: this.level,
            totalLevels: this.totalLevels,
        };
    }

    static deserialize(json: string): OrderOpenedEvent {
        const data = JSON.parse(json);
        return new OrderOpenedEvent(
            data.gridId,
            data.symbol,
            data.side,
            data.price,
            data.amount,
            data.total,
            data.level,
            data.totalLevels,
            data.timestamp,
        );
    }
}
