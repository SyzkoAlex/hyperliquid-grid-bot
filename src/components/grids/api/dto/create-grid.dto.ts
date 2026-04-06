import { GridMode } from '@domain/models/grid/grid-mode';

export interface CreateGridDto {
    id: string;
    symbol: string;
    mode: GridMode;
    lowerPrice: number;
    upperPrice: number;
    levels: number;
    investmentUSDC: number;
    investmentBase: number;
    creationPrice?: number;
    trailingEnabled: boolean;
    trailingTriggerPercent?: number;
    trailingStepPercent?: number;
    trailingPartialClosePercent?: number;
}
