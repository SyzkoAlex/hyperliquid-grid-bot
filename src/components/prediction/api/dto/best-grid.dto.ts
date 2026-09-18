import { RecommendedGridConfigDto } from './recommended-grid-config.dto';
import { PredictionWarning } from './prediction-warning';

export interface BestGridDto {
    pair: string;
    baseAsset: string;
    /** Retrospective lower-bound PnL in USDC at the server's $1000 test budget; null = no track record. */
    conservativePnlUsdc: number | null;
    /** Null when the service found nothing fittable. */
    recommendedConfig: RecommendedGridConfigDto | null;
    warnings: PredictionWarning[];
    /** Length in days of each backtested period (context for the headline figure). */
    periodDays: number;
}
