export interface CalculateMaxInvestmentDto {
    symbol: string;
    usdcBalance: number;
    baseBalance: number;
    currentPrice: number;
    levels: number;
    lowerPrice: number;
    upperPrice: number;
}
