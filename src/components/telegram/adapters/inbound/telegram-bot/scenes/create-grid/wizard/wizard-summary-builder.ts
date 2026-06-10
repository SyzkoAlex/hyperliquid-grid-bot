import { Injectable } from '@nestjs/common';
import { CreateGridWizardState } from '../create-grid-wizard-state';
import { SceneStep } from '../create-grid-scene-step';
import { CreateGridMode } from '../create-grid-mode';
import { formatFiat } from '@components/telegram/core/domain/models/formatters/format-fiat';
import { PriceFormatter } from '@components/telegram/core/domain/models/formatters/price.formatter';

@Injectable()
export class WizardSummaryBuilder {
    buildSummaryFromSession(state: CreateGridWizardState | undefined): string {
        if (!state?.stepHistory || state.stepHistory.length === 0) return '';

        const rows: string[] = [];
        const seen = new Set<SceneStep>();
        for (const step of state.stepHistory) {
            // Skip duplicate steps (e.g. Quick appears twice after a swap round-trip)
            if (seen.has(step)) continue;
            seen.add(step);
            const row = this.buildRowForStep(step, state);
            if (row !== null) rows.push(row);
        }
        return rows.join('\n');
    }

    private buildRowForStep(step: SceneStep, state: CreateGridWizardState): string | null {
        switch (step) {
            case SceneStep.Pair: {
                const symbol = state.symbol;
                if (!symbol) return null;
                const priceStr =
                    state.currentPrice !== undefined ? ` ($${formatFiat(state.currentPrice)})` : '';
                return `✓ <b>Pair</b> · ${symbol}${priceStr}`;
            }
            case SceneStep.Mode: {
                if (!state.mode) return null;
                const modeLabel = state.mode === CreateGridMode.Quick ? 'Quick' : 'Advanced';
                return `✓ <b>Mode</b> · ${modeLabel}`;
            }
            case SceneStep.Upper: {
                if (state.upperPrice === undefined) return null;
                return `✓ <b>Upper</b> · $${PriceFormatter.format(state.upperPrice)}`;
            }
            case SceneStep.Lower: {
                if (state.lowerPrice === undefined) return null;
                return `✓ <b>Lower</b> · $${PriceFormatter.format(state.lowerPrice)}`;
            }
            case SceneStep.Levels: {
                if (state.levels === undefined) return null;
                return `✓ <b>Levels</b> · ${state.levels}`;
            }
            case SceneStep.Quick: {
                if (state.totalInvestmentUSDC === undefined) return null;
                const lines: string[] = [];
                if (state.upperPrice !== undefined)
                    lines.push(`✓ <b>Upper</b> · $${PriceFormatter.format(state.upperPrice)}`);
                if (state.lowerPrice !== undefined)
                    lines.push(`✓ <b>Lower</b> · $${PriceFormatter.format(state.lowerPrice)}`);
                if (state.levels !== undefined) lines.push(`✓ <b>Levels</b> · ${state.levels}`);
                lines.push(`✓ <b>Investment</b> · $${state.totalInvestmentUSDC} USDC`);
                return lines.join('\n');
            }
            case SceneStep.Investment: {
                if (state.totalInvestmentUSDC === undefined) return null;
                return `✓ <b>Investment</b> · $${state.totalInvestmentUSDC} USDC`;
            }
            case SceneStep.StopLoss: {
                if (!state.stopLossEnabled || state.stopLossPrice === undefined) {
                    return `✓ <b>Stop Loss</b> · Disabled`;
                }
                return `✓ <b>Stop Loss</b> · $${PriceFormatter.format(state.stopLossPrice)}`;
            }
            default:
                return null;
        }
    }
}
