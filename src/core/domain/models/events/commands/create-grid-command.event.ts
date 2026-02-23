import { SerializableEvent } from '../trading/trading-event';
import { EventType } from '../event-type';

export class CreateGridCommandEvent extends SerializableEvent {
    constructor(
        public readonly symbol: string,
        public readonly lowerPrice: number,
        public readonly upperPrice: number,
        public readonly mode: string,
        public readonly levels: number,
        public readonly totalInvestmentUSDC: number | undefined,
        public readonly trailing: boolean,
        timestamp?: number,
    ) {
        super(EventType.CreateGridCommand, timestamp);
    }

    static create(params: {
        symbol: string;
        lowerPrice: number;
        upperPrice: number;
        mode?: string;
        levels?: number;
        totalInvestmentUSDC?: number;
        trailing?: boolean;
    }): CreateGridCommandEvent {
        return new CreateGridCommandEvent(
            params.symbol,
            params.lowerPrice,
            params.upperPrice,
            params.mode || 'neutral',
            params.levels || 20,
            params.totalInvestmentUSDC,
            params.trailing ?? false,
        );
    }

    protected toJSON(): Record<string, any> {
        return {
            symbol: this.symbol,
            lowerPrice: this.lowerPrice,
            upperPrice: this.upperPrice,
            mode: this.mode,
            levels: this.levels,
            totalInvestmentUSDC: this.totalInvestmentUSDC,
            trailing: this.trailing,
        };
    }

    static deserialize(json: string): CreateGridCommandEvent {
        const data = JSON.parse(json);
        return new CreateGridCommandEvent(
            data.symbol,
            data.lowerPrice,
            data.upperPrice,
            data.mode,
            data.levels,
            data.totalInvestmentUSDC,
            data.trailing,
            data.timestamp,
        );
    }
}
