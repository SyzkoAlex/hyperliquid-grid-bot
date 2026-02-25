import { GridStatus } from '@domain/models/grid/grid-status';
import { GridMode } from '@domain/models/grid/grid-mode';

export interface GridDto {
    id: string;
    symbol: string;
    mode: GridMode;
    status: GridStatus;
    lowerPrice: number;
    upperPrice: number;
    levels: number;
    investmentUSDC: number;
    investmentBase: number;
    trailingEnabled: boolean;
    trailingTriggerPercent: number;
    trailingStepPercent: number;
    trailingPartialClosePercent: number;
    createdAt?: number; // timestamp ms
    startedAt?: number;
    stoppedAt?: number;
}
