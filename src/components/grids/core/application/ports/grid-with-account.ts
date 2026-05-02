import { Grid } from '../../domain/models/grid/grid';

export interface GridWithAccount {
    grid: Grid;
    accountAddress: string;
}
