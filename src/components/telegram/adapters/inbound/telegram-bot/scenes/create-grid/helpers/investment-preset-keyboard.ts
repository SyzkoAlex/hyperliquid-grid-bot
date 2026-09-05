import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';
import { CREATE_GRID_ACTIONS, InvestmentPresetKey } from '../create-grid-actions';

/**
 * Shared investment-step keyboard: preset percentage rows (when a suggested max
 * is known), an optional swap-offer row, the Custom row, and Back/Cancel.
 * `buildPresetAction` parameterizes the callback-action namespace per step
 * (quick / ai / advanced).
 */
export function buildInvestmentPresetKeyboard(
    suggestedMax: number | null,
    hasSwapOffer: boolean,
    buildPresetAction: (key: InvestmentPresetKey) => string,
): InlineButton[][] {
    const isProactiveSwap = suggestedMax !== null && hasSwapOffer;
    const rows: InlineButton[][] = [];
    if (suggestedMax !== null) {
        rows.push(
            [
                {
                    text: `25% ($${Math.round(suggestedMax * 0.25)})`,
                    action: buildPresetAction(InvestmentPresetKey.P25),
                },
                {
                    text: `50% ($${Math.round(suggestedMax * 0.5)})`,
                    action: buildPresetAction(InvestmentPresetKey.P50),
                },
            ],
            [
                {
                    text: `75% ($${Math.round(suggestedMax * 0.75)})`,
                    action: buildPresetAction(InvestmentPresetKey.P75),
                },
                {
                    text: `Max ($${suggestedMax})`,
                    action: buildPresetAction(InvestmentPresetKey.Max),
                },
            ],
        );
    }
    if (hasSwapOffer) {
        const swapLabel = isProactiveSwap
            ? `${EMOJI.REFRESH} Swap to maximize`
            : `${EMOJI.REFRESH} Swap to fit grid`;
        rows.push([{ text: swapLabel, action: CREATE_GRID_ACTIONS.SWAP_OFFER }]);
    }
    rows.push([
        {
            text: BUTTON_LABELS.CUSTOM,
            action: buildPresetAction(InvestmentPresetKey.Custom),
        },
    ]);
    rows.push([
        { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
        { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
    ]);
    return rows;
}
