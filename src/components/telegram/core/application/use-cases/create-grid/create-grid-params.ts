import { GridMode } from '@domain/models/grid/grid-mode';

export interface CreateGridParams {
    symbol: string;
    mode: GridMode;
    lowerPrice: number;
    upperPrice: number;
    levels: number;
    totalInvestmentUSDC?: number;
}
