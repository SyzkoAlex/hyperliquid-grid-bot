import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridPnl } from '../../../domain/models/grid-pnl';
import { OrderStats } from '../../../domain/models/order-stats';

export interface GridWithPnl {
    grid: GridDto;
    pnl: GridPnl;
    currentPrice: number;
    orderStats: OrderStats;
    orders: OrderDto[];
}
