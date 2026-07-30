export interface CalculateMaxInvestmentDto {
    symbol: string;
    usdcBalance: number;
    baseBalance: number;
    currentPrice: number;
    orderCount: number;
    lowerPrice: number;
    upperPrice: number;
}
