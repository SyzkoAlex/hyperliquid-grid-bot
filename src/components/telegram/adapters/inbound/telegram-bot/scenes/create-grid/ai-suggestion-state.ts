import { AiSuggestionSource } from './ai-suggestion-source';
import { PredictionWarning } from '@components/prediction/api/dto/prediction-warning';

/** Cached /suggest outcome for the AI step — avoids a seconds-scale re-fetch on Back navigation. */
export interface AiSuggestionState {
    source: AiSuggestionSource;
    lowerPrice: number;
    upperPrice: number;
    orderCount: number;
    conservativePnlUsdc?: number | null;
    warnings?: PredictionWarning[];
    periodDays?: number;
}
