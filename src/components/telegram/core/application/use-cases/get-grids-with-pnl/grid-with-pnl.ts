import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridPnl, OrderStats } from '../../../domain/models/grid-pnl';

export { GridPnl, OrderStats };

export interface GridWithPnl {
    grid: GridDto;
    pnl: GridPnl;
    currentPrice: number;
    orderStats: OrderStats;
    orders: OrderDto[];
}
