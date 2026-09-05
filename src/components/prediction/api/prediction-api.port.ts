import { BestGridDto } from './dto/best-grid.dto';

export const PREDICTION_API_PORT = Symbol('PREDICTION_API_PORT');

export interface PredictionApiPort {
    /** True when the prediction service base URL is configured. */
    isAvailable(): boolean;
    /**
     * Fetch the best-grid recommendation for a base asset (bot spot symbol, e.g. "HYPE").
     * Returns null for an unknown ticker (404). Throws on transport/server errors or when unconfigured.
     */
    getBestGrid(ticker: string): Promise<BestGridDto | null>;
}
