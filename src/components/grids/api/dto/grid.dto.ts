import { GridStatus } from '@domain/models/grid/grid-status';

export interface GridDto {
    id: string;
    symbol: string;
    status: GridStatus;
    lowerPrice: number;
    upperPrice: number;
    levels: number;
    investmentUSDC: number;
    investmentBase: number;
    creationPrice?: number;
    trailingEnabled: boolean;
    trailingTriggerPercent: number;
    trailingStepPercent: number;
    trailingPartialClosePercent: number;
    createdAt?: number; // timestamp ms
    startedAt?: number;
    stoppedAt?: number;
    stopLossEnabled: boolean;
    stopLossPrice?: number;
    stopLossTriggeredAt?: number; // timestamp ms
}
