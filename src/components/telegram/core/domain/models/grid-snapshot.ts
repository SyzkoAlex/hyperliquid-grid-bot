import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridPnl } from './grid-pnl';
import { OrderStats } from './order-stats';

export interface GridSnapshot {
    grid: GridDto;
    pnl: GridPnl;
    currentPrice: number;
    orderStats: OrderStats;
    activeOrders: OrderDto[];
    filledOrders: OrderDto[];
}
