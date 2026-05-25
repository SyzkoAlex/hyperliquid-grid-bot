import { Inject, Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import {
    CREATE_GRID_ACTIONS,
    InvestmentPresetKey,
    buildAdvInvestmentPreset,
} from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { StepView } from '../wizard/step-view';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { logger } from '@/infra/logger/logger';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { AdvancedInvestmentPromptMessage } from '@components/telegram/core/domain/models/messages/wizard/advanced-investment.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { buildInvestmentView } from '../helpers/investment-view-builder';
import { validateInvestment } from '../helpers/investment-validator';

@Injectable()
export class AdvancedInvestmentStep implements WizardStep {
    readonly id = SceneStep.Investment;
    private readonly logger = logger.child({ context: AdvancedInvestmentStep.name });

    constructor(@Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort) {}

    async buildView(ctx: BotContext): Promise<StepView> {
        const session = ctx.session;
        const symbol = session.createGrid?.symbol;
        const levels = session.createGrid?.levels ?? WIZARD_CONFIG.DEFAULT_LEVELS;
        const accountAddress = ctx.user?.accountAddress;

        let suggestedMax: number | null = null;
        let body = AdvancedInvestmentPromptMessage.create().text;

        if (symbol && accountAddress) {
            try {
                const storedUpper = session.createGrid?.upperPrice;
                const storedLower = session.createGrid?.lowerPrice;
                const [lowerPrice, upperPrice] =
                    storedUpper && storedLower
                        ? [storedLower, storedUpper]
                        : await this.computePriceRange(symbol);

                const result = await buildInvestmentView(
                    this.tradingApi,
                    accountAddress,
                    symbol,
                    levels,
                    lowerPrice,
                    upperPrice,
                    {
                        fallback: () => AdvancedInvestmentPromptMessage.create().text,
                        withBalance: (info) =>
                            AdvancedInvestmentPromptMessage.create({
                                symbol: info.symbol,
                                usdcBalance: info.usdcBalance,
                                baseBalance: info.baseBalance,
                                baseInUsdc: info.baseInUsdc,
                                totalBalance: info.totalBalance,
                                currentPrice: info.currentPrice,
                                suggestedMax: info.suggestedMax,
                                levels,
                            }).text,
                    },
                );

                body = result.body;
                suggestedMax = result.suggestedMax;

                if (suggestedMax !== null && session.createGrid) {
                    session.createGrid.balanceSnapshot = { suggestedMax };
                }
            } catch (error) {
                this.logger.warn({ error }, 'Failed to fetch balance in advanced investment step');
            }
        }

        return {
            body,
            keyboard: this.buildKeyboard(suggestedMax),
        };
    }

    private buildKeyboard(suggestedMax: number | null): InlineButton[][] {
        const presets: InlineButton[] = [];
        if (suggestedMax !== null) {
            presets.push(
                {
                    text: `25% ($${Math.round(suggestedMax * 0.25)})`,
                    action: buildAdvInvestmentPreset(InvestmentPresetKey.P25),
                },
                {
                    text: `50% ($${Math.round(suggestedMax * 0.5)})`,
                    action: buildAdvInvestmentPreset(InvestmentPresetKey.P50),
                },
                {
                    text: `75% ($${Math.round(suggestedMax * 0.75)})`,
                    action: buildAdvInvestmentPreset(InvestmentPresetKey.P75),
                },
                {
                    text: `Max ($${suggestedMax})`,
                    action: buildAdvInvestmentPreset(InvestmentPresetKey.Max),
                },
            );
        }
        const rows: InlineButton[][] = presets.length ? [presets] : [];
        rows.push([
            {
                text: BUTTON_LABELS.CUSTOM,
                action: buildAdvInvestmentPreset(InvestmentPresetKey.Custom),
            },
        ]);
        rows.push([
            { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
            { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
        ]);
        return rows;
    }

    async handleInvestmentPreset(ctx: BotContext, key: string): Promise<StepResult> {
        if (key === InvestmentPresetKey.Custom) {
            if (ctx.session.createGrid) {
                ctx.session.createGrid.pendingError = ValidationTexts.enterCustomInvestment();
            }
            return null;
        }
        const snapshot = ctx.session.createGrid?.balanceSnapshot;
        if (!snapshot) return null;
        const { suggestedMax } = snapshot;
        let investment: number;
        switch (key) {
            case InvestmentPresetKey.P25:
                investment = Math.round(suggestedMax * 0.25);
                break;
            case InvestmentPresetKey.P50:
                investment = Math.round(suggestedMax * 0.5);
                break;
            case InvestmentPresetKey.P75:
                investment = Math.round(suggestedMax * 0.75);
                break;
            case InvestmentPresetKey.Max:
                investment = suggestedMax;
                break;
            default:
                return null;
        }
        return this.applyTextInput(ctx, String(investment));
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        return this.applyTextInput(ctx, text);
    }

    private async applyTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const session = ctx.session;
        const accountAddress = ctx.user?.accountAddress;
        if (
            !session.createGrid?.levels ||
            !session.createGrid?.upperPrice ||
            !session.createGrid?.lowerPrice ||
            !session.createGrid?.symbol ||
            !accountAddress
        ) {
            return null;
        }

        const investment = parseFloat(text);

        try {
            const result = await validateInvestment(
                {
                    investment,
                    levels: session.createGrid.levels,
                    symbol: session.createGrid.symbol,
                    upperPrice: session.createGrid.upperPrice,
                    lowerPrice: session.createGrid.lowerPrice,
                    accountAddress,
                },
                this.tradingApi,
            );

            if (!result.valid) {
                session.createGrid.pendingError = result.errorMessage ?? undefined;
                return null;
            }

            session.createGrid.totalInvestmentUSDC = investment;
            return { nextStep: SceneStep.StopLoss };
        } catch (error) {
            this.logger.error({ error }, 'Failed to validate balance in advanced investment step');
            session.createGrid.pendingError = ValidationTexts.fetchDataFailed(
                session.createGrid.symbol,
            );
            return null;
        }
    }

    private async computePriceRange(symbol: string): Promise<[number, number]> {
        const currentPrice = await this.tradingApi.getCurrentPrice(symbol);
        const priceOffset = currentPrice * (WIZARD_CONFIG.PRICE_RANGE_PERCENT / 100);
        return [currentPrice - priceOffset, currentPrice + priceOffset];
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.totalInvestmentUSDC;
            delete ctx.session.createGrid.balanceSnapshot;
        }
    }
}
