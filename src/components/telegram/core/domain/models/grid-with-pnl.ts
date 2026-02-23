import { Grid } from '@domain/models/grid/grid';
import { Order } from '@domain/models/order/order';
import { GridPnl } from '@domain/services/grid-pnl-calculator/grid-pnl-calculator.service';

export { GridPnl };

export interface OrderStats {
    activeBuys: number;
    activeSells: number;
    avgActiveBuyPrice: number;
    avgActiveSellPrice: number;
    lowestActiveBuyPrice: number;
    highestActiveSellPrice: number;
    filledCycles: number;
}

export interface GridWithPnl {
    grid: Grid;
    pnl: GridPnl;
    currentPrice: number;
    orderStats: OrderStats;
    orders: Order[];
}
