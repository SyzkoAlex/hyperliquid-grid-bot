import { GridStatus } from '@domain/models/grid/grid-status';
import { GridPnlDto } from '@components/grids/api/dto/grid-pnl.dto';
import { OrderStatsDto } from '@components/grids/api/dto/order-stats.dto';

export interface WebGridDto {
    id: string;
    symbol: string;
    status: GridStatus;
    lowerPrice: number;
    upperPrice: number;
    orderCount: number;
    investmentUSDC: number;
    investmentBase: number;
    creationPrice?: number;
    createdAt?: number;
    startedAt?: number;
    stoppedAt?: number;
    stopPrice?: number;
    stopLossEnabled: boolean;
    stopLossPrice?: number;
    stopLossTriggeredAt?: number;
    currentPrice: number;
    pnl: GridPnlDto;
    orderStats: OrderStatsDto;
}
