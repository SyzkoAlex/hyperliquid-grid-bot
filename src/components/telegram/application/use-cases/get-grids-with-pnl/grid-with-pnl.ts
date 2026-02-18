import { Grid } from '@domain/models/grid/grid';

export interface GridWithPnl {
    grid: Grid;
    pnl: number;
    currentPrice: number;
    profitableTrades: number;
}
