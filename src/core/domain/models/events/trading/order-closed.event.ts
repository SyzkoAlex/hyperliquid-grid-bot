import { SerializableEvent } from './trading-event';
import { EventType } from '../event-type';

export class OrderClosedEvent extends SerializableEvent {
    constructor(
        public readonly userId: string,
        public readonly gridId: string,
        public readonly symbol: string,
        public readonly side: string,
        public readonly price: number,
        public readonly amount: number,
        public readonly total: number,
        public readonly profit: number,
        public readonly level: number,
        public readonly totalLevels: number,
        timestamp?: number,
    ) {
        super(EventType.OrderClosed, userId, timestamp);
    }

    protected toJSON(): Record<string, any> {
        return {
            gridId: this.gridId,
            symbol: this.symbol,
            side: this.side,
            price: this.price,
            amount: this.amount,
            total: this.total,
            profit: this.profit,
            level: this.level,
            totalLevels: this.totalLevels,
        };
    }

    static deserialize(json: string): OrderClosedEvent {
        const data = JSON.parse(json);
        return new OrderClosedEvent(
            data.userId,
            data.gridId,
            data.symbol,
            data.side,
            data.price,
            data.amount,
            data.total,
            data.profit,
            data.level,
            data.totalLevels,
            data.timestamp,
        );
    }
}
