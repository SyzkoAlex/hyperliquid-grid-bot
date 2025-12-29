/**
 * Create Grid Command Event
 * Published by Telegram Bot when user requests grid creation
 * Consumed by Trading component to create and start grid
 */
export class CreateGridCommandEvent {
    constructor(
        public readonly chatId: number,
        public readonly symbol: string,
        public readonly lowerPrice: number,
        public readonly upperPrice: number,
        public readonly mode: string,
        public readonly levels: number,
        public readonly totalInvestmentUSDC: number | undefined,
        public readonly trailing: boolean,
    ) {}

    /**
     * Create event with default values
     */
    static create(params: {
        chatId: number;
        symbol: string;
        lowerPrice: number;
        upperPrice: number;
        mode?: string;
        levels?: number;
        totalInvestmentUSDC?: number;
        trailing?: boolean;
    }): CreateGridCommandEvent {
        return new CreateGridCommandEvent(
            params.chatId,
            params.symbol,
            params.lowerPrice,
            params.upperPrice,
            params.mode || 'neutral',
            params.levels || 20,
            params.totalInvestmentUSDC,
            params.trailing ?? false,
        );
    }
}
