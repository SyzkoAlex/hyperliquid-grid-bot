import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { replyWithKeyboard } from '../helpers/keyboard.helper';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '../../../../../domain/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { UserBalanceExtractorService } from '@components/shared/core/services/user-balance-extractor/user-balance-extractor.service';
import { CapitalCalculatorService } from '@components/shared/core/services/capital-calculator/capital-calculator.service';
import { Config } from '@infra/config/config.schema';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { GridMode } from '@domain/grid/grid-mode';
import { logger } from '@infra/logger/logger';

@Injectable()
export class AdvancedPreviewStep {
    private readonly accountAddress: string;

    constructor(
        private readonly hyperliquidClient: HyperliquidInfoClient,
        private readonly userBalanceExtractor: UserBalanceExtractorService,
        private readonly capitalCalculator: CapitalCalculatorService,
        configService: ConfigService<Config, true>,
    ) {
        this.accountAddress = configService.get('hyperliquid.accountAddress', { infer: true });
    }

    async enter(ctx: BotContext): Promise<void> {
        if (!this.validateState(ctx)) {
            await replyWithKeyboard(ctx, '❌ Invalid state. Please start over.');
            await ctx.scene.leave();
            return;
        }

        const session = ctx.session;
        const state = session.createGrid!;
        const orderSize =
            state.totalInvestmentUSDC && state.levels
                ? (state.totalInvestmentUSDC / state.levels).toFixed(2)
                : 'N/A';

        const keyboard: InlineButton[][] = [
            [{ text: '✅ Confirm', action: CREATE_GRID_ACTIONS.CONFIRM }],
            [
                { text: '← Back', action: CREATE_GRID_ACTIONS.BACK },
                { text: '❌ Cancel', action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];

        let balanceWarning = '';
        try {
            const tradingSymbol = TradingSymbol.fromString(state.symbol!);
            const currentPrice = await this.hyperliquidClient.getCurrentPrice(tradingSymbol);

            const userState = await this.hyperliquidClient.getUserSpotState(this.accountAddress);
            const { usdcBalance, baseBalance } = this.userBalanceExtractor.extractBalances(
                userState,
                state.symbol!,
            );

            const distribution = this.capitalCalculator.calculateDistribution({
                mode: GridMode.Neutral,
                totalInvestmentUSDC: state.totalInvestmentUSDC!,
                usdcBalance,
                baseBalance,
                currentPrice,
                lowerPrice: state.lowerPrice!,
                upperPrice: state.upperPrice!,
            });

            const warnings: string[] = [];
            if (usdcBalance.lt(distribution.investmentUSDC)) {
                warnings.push(
                    `⚠️ USDC balance (${usdcBalance.toString()}) is less than required (${distribution.investmentUSDC.toString()})`,
                );
            }
            if (baseBalance.lt(distribution.investmentBase)) {
                warnings.push(
                    `⚠️ ${state.symbol} balance (${baseBalance.toString()}) is less than optimal (${distribution.investmentBase.toString()})`,
                );
            }

            if (warnings.length > 0) {
                balanceWarning =
                    `\n\n` +
                    warnings.join('\n') +
                    `\n\nWe'll place orders from current price while you have enough tokens.`;
            }
        } catch (error) {
            logger.warn({ error }, 'Failed to check balance in preview step');
        }

        const message =
            `<b>📋 Grid Configuration Preview</b>\n\n` +
            `🔸 Symbol: ${state.symbol}\n` +
            `🔸 Mode: ${state.mode}\n` +
            `🔸 Price Range: ${state.lowerPrice?.toFixed(4)} - ${state.upperPrice?.toFixed(4)}\n` +
            `🔸 Levels: ${state.levels}\n` +
            `🔸 Investment: ${state.totalInvestmentUSDC} USDC\n` +
            `🔸 Order Size: ~${orderSize} USDC per level` +
            balanceWarning +
            `\n\nReady to create grid?`;

        await replyWithKeyboard(ctx, message, keyboard, 'HTML');
    }

    private validateState(ctx: BotContext): boolean {
        const session = ctx.session;
        const state = session.createGrid;
        return !!(
            state?.symbol &&
            state?.mode &&
            state?.upperPrice &&
            state?.lowerPrice &&
            state?.levels &&
            state?.totalInvestmentUSDC
        );
    }

    async handleConfirm(_ctx: BotContext): Promise<'confirm'> {
        return 'confirm';
    }

    async handleBack(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        const state = session.createGrid;
        if (!state) {
            return;
        }

        if (state.mode === 'quick') {
            delete state.totalInvestmentUSDC;
            delete state.upperPrice;
            delete state.lowerPrice;
            delete state.levels;
        } else {
            delete state.totalInvestmentUSDC;
        }
    }

    async handleCancel(ctx: BotContext): Promise<void> {
        await ctx.scene.leave();
    }
}
