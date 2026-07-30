export interface CreateAndStartGridParams {
    address: string;
    symbol: string;
    lowerPrice: number;
    upperPrice: number;
    orderCount: number;
    totalInvestmentUSDC?: number;
    trailingEnabled: boolean;
    trailingTriggerPercent?: number;
    trailingStepPercent?: number;
    trailingPartialClosePercent?: number;
    stopLossEnabled?: boolean;
    stopLossPrice?: number;
}
