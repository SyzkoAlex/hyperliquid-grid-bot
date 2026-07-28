export interface CalculateCapitalDistributionDto {
    symbol: string;
    orderCount: number;
    totalInvestmentUSDC?: number;
    usdcBalance: number;
    baseBalance: number;
    currentPrice: number;
    lowerPrice: number;
    upperPrice: number;
}
