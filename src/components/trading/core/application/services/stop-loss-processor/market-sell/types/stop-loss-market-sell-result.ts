export interface StopLossMarketSellResult {
    success: boolean;
    soldBaseAmount: number;
    receivedUSDC: number;
    errorMessage?: string;
}
