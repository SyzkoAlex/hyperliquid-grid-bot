import { GridDto } from './grid.dto';
import { OrderDto } from './order.dto';
import { GridPnlDto } from './grid-pnl.dto';
import { OrderStatsDto } from './order-stats.dto';

export interface GridSnapshotDto {
    grid: GridDto;
    pnl: GridPnlDto;
    currentPrice: number;
    orderStats: OrderStatsDto;
    activeOrders: OrderDto[];
    filledOrders: OrderDto[];
}
