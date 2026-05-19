import { SerializableEvent } from '../trading/trading-event';
import { EventType } from '../event-type';

export class CreateGridCommandEvent extends SerializableEvent {
    constructor(
        public readonly userId: string,
        public readonly symbol: string,
        public readonly lowerPrice: number,
        public readonly upperPrice: number,
        public readonly levels: number,
        public readonly totalInvestmentUSDC: number | undefined,
        public readonly trailing: boolean,
        public readonly accountAddress: string,
        public readonly stopLossEnabled: boolean,
        public readonly stopLossPrice: number | undefined,
        timestamp?: number,
    ) {
        super(EventType.CreateGridCommand, userId, timestamp);
    }

    static create(params: {
        userId: string;
        symbol: string;
        lowerPrice: number;
        upperPrice: number;
        levels?: number;
        totalInvestmentUSDC?: number;
        trailing?: boolean;
        accountAddress: string;
        stopLossEnabled?: boolean;
        stopLossPrice?: number;
    }): CreateGridCommandEvent {
        return new CreateGridCommandEvent(
            params.userId,
            params.symbol,
            params.lowerPrice,
            params.upperPrice,
            params.levels || 20,
            params.totalInvestmentUSDC,
            params.trailing ?? false,
            params.accountAddress,
            params.stopLossEnabled ?? false,
            params.stopLossPrice,
        );
    }

    protected toJSON(): Record<string, unknown> {
        return {
            symbol: this.symbol,
            lowerPrice: this.lowerPrice,
            upperPrice: this.upperPrice,
            levels: this.levels,
            totalInvestmentUSDC: this.totalInvestmentUSDC,
            trailing: this.trailing,
            accountAddress: this.accountAddress,
            stopLossEnabled: this.stopLossEnabled,
            stopLossPrice: this.stopLossPrice,
        };
    }

    static deserialize(json: string): CreateGridCommandEvent {
        const data = JSON.parse(json);
        return new CreateGridCommandEvent(
            data.userId,
            data.symbol,
            data.lowerPrice,
            data.upperPrice,
            data.levels,
            data.totalInvestmentUSDC,
            data.trailing,
            data.accountAddress,
            data.stopLossEnabled ?? false,
            data.stopLossPrice,
            data.timestamp,
        );
    }
}
