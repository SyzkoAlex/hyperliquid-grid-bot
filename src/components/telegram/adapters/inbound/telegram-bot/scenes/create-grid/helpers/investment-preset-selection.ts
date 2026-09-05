import { BotContext } from '../../../types/bot-context';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { InvestmentPresetKey } from '../create-grid-actions';
import { StepResult } from '../wizard/step-result';

function resolvePresetInvestment(key: string, suggestedMax: number): number | null {
    switch (key) {
        case InvestmentPresetKey.P25:
            return Math.round(suggestedMax * 0.25);
        case InvestmentPresetKey.P50:
            return Math.round(suggestedMax * 0.5);
        case InvestmentPresetKey.P75:
            return Math.round(suggestedMax * 0.75);
        case InvestmentPresetKey.Max:
            return suggestedMax;
        default:
            return null;
    }
}

/**
 * Shared investment-preset flow for the Quick/AI/Advanced investment steps:
 * Custom → prompt for manual input via pendingError; percentage/Max → resolve
 * the amount from the balance snapshot and delegate to the step's own
 * text-input application.
 */
export async function handleInvestmentPresetSelection(
    ctx: BotContext,
    key: string,
    applyInvestment: (text: string) => Promise<StepResult>,
): Promise<StepResult> {
    if (key === InvestmentPresetKey.Custom) {
        if (ctx.session.createGrid) {
            ctx.session.createGrid.pendingError = ValidationTexts.enterCustomInvestment();
        }
        return null;
    }
    const snapshot = ctx.session.createGrid?.balanceSnapshot;
    if (!snapshot) return null;
    const investment = resolvePresetInvestment(key, snapshot.suggestedMax);
    if (investment === null) return null;
    return applyInvestment(String(investment));
}
