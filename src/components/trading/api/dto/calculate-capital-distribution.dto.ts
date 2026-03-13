import { GridMode } from '@domain/models/grid/grid-mode';

export interface CalculateCapitalDistributionDto {
    mode: GridMode;
    totalInvestmentUSDC?: number;
    usdcBalance: number;
    baseBalance: number;
    currentPrice: number;
    lowerPrice: number;
    upperPrice: number;
}
