export interface CalculateCapitalDistributionDto {
    symbol: string;
    levels: number;
    totalInvestmentUSDC?: number;
    usdcBalance: number;
    baseBalance: number;
    currentPrice: number;
    lowerPrice: number;
    upperPrice: number;
}
