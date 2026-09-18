import { PredictionWarning } from '@components/prediction/api/dto/prediction-warning';
import { EMOJI } from '../../constants/emoji';

const LABELS: Record<PredictionWarning, string> = {
    [PredictionWarning.LowLiquidity]: 'Low trading volume — fills may be slow',
    [PredictionWarning.TrendingMarket]: 'Market is trending — grids perform best in ranges',
    [PredictionWarning.TrendingRegime]: 'Trending regime detected — grid may underperform',
    [PredictionWarning.InsufficientHistory]: 'Limited price history — less reliable backtest',
    [PredictionWarning.UnstableFit]: 'Unstable backtest results — treat with caution',
};

export function predictionWarningLines(warnings: PredictionWarning[]): string[] {
    return warnings.map((warning) => `${EMOJI.WARNING} ${LABELS[warning]}`);
}
