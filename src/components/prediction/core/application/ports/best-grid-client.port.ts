import { BestGridDto } from '../../../api/dto/best-grid.dto';

export const BEST_GRID_CLIENT_PORT = Symbol('BEST_GRID_CLIENT_PORT');

export interface BestGridClientPort {
    fetchBestGrid(ticker: string): Promise<BestGridDto | null>;
}
