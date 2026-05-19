import { SerializableEvent } from './trading-event';
import { EventType } from '../event-type';

export class GridStopLossTriggeredEvent extends SerializableEvent {
    constructor(
        userId: string,
        public readonly gridId: string,
        public readonly symbol: string,
        public readonly stopLossPrice: number,
        public readonly triggerPrice: number,
        public readonly soldBaseAmount: number,
        public readonly receivedUSDC: number,
        public readonly success: boolean,
        public readonly errorMessage: string | undefined,
        timestamp?: number,
    ) {
        super(EventType.GridStopLossTriggered, userId, timestamp);
    }

    protected toJSON(): Record<string, unknown> {
        return {
            gridId: this.gridId,
            symbol: this.symbol,
            stopLossPrice: this.stopLossPrice,
            triggerPrice: this.triggerPrice,
            soldBaseAmount: this.soldBaseAmount,
            receivedUSDC: this.receivedUSDC,
            success: this.success,
            errorMessage: this.errorMessage,
        };
    }

    static deserialize(json: string): GridStopLossTriggeredEvent {
        const data = JSON.parse(json);
        return new GridStopLossTriggeredEvent(
            data.userId,
            data.gridId,
            data.symbol,
            data.stopLossPrice,
            data.triggerPrice,
            data.soldBaseAmount,
            data.receivedUSDC,
            data.success,
            data.errorMessage,
            data.timestamp,
        );
    }
}
