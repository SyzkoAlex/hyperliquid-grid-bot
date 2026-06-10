export interface CalculateOptimalSwapDto {
    symbol: string;
    usdcBalance: number;
    baseBalance: number;
    currentPrice: number;
    lowerPrice: number;
    upperPrice: number;
    levels: number;
}
