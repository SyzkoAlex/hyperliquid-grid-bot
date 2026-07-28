export interface CreateGridDto {
    id: string;
    userId: string;
    symbol: string;
    lowerPrice: number;
    upperPrice: number;
    orderCount: number;
    investmentUSDC: number;
    investmentBase: number;
    creationPrice?: number;
    trailingEnabled: boolean;
    trailingTriggerPercent?: number;
    trailingStepPercent?: number;
    trailingPartialClosePercent?: number;
    stopLossEnabled: boolean;
    stopLossPrice?: number;
}
