import { GridMode } from '../../domain/grid/grid-mode';

export interface CreateAndStartGridParams {
    chatId: number;
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
