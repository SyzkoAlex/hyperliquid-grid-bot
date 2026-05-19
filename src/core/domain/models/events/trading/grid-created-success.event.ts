import { SerializableEvent } from './trading-event';
import { EventType } from '../event-type';

export class GridCreatedSuccessEvent extends SerializableEvent {
    constructor(
        public readonly userId: string,
        public readonly gridId: string,
        public readonly symbol: string,
        public readonly lowerPrice: number,
        public readonly upperPrice: number,
        public readonly levels: number,
        public readonly investmentUSDC: number,
        public readonly investmentBase: number,
        public readonly trailingEnabled: boolean,
        timestamp?: number,
    ) {
        super(EventType.GridCreatedSuccess, userId, timestamp);
    }

    protected toJSON(): Record<string, any> {
        return {
            gridId: this.gridId,
            symbol: this.symbol,
            lowerPrice: this.lowerPrice,
            upperPrice: this.upperPrice,
            levels: this.levels,
            investmentUSDC: this.investmentUSDC,
            investmentBase: this.investmentBase,
            trailingEnabled: this.trailingEnabled,
        };
    }

    static deserialize(json: string): GridCreatedSuccessEvent {
        const data = JSON.parse(json);
        return new GridCreatedSuccessEvent(
            data.userId,
            data.gridId,
            data.symbol,
            data.lowerPrice,
            data.upperPrice,
            data.levels,
            data.investmentUSDC,
            data.investmentBase,
            data.trailingEnabled,
            data.timestamp,
        );
    }
}
