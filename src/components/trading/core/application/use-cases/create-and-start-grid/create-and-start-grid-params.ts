import { GridMode } from '@domain/models/grid/grid-mode';

export interface CreateAndStartGridParams {
    address: string;
    symbol: string;
    mode: GridMode;
    lowerPrice: number;
    upperPrice: number;
    levels: number;
    totalInvestmentUSDC?: number;
    trailingEnabled: boolean;
    trailingTriggerPercent?: number;
    trailingStepPercent?: number;
    trailingPartialClosePercent?: number;
}
