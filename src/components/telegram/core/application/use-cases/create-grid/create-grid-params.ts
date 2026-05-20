export interface CreateGridParams {
    userId: string;
    symbol: string;
    lowerPrice: number;
    upperPrice: number;
    levels: number;
    totalInvestmentUSDC?: number;
    accountAddress: string;
    stopLossEnabled?: boolean;
    stopLossPrice?: number;
}
