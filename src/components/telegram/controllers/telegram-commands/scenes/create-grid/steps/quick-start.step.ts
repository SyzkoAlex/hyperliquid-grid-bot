import { WizardContext } from '../../../../../core/domain/wizard-context';
import { InlineButton } from '../../../../../core/domain/inline-button';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { TradingSymbol } from '@domain/primitives/trading-symbol';

const MIN_INVESTMENT = 10;
const PRICE_RANGE_PERCENT = 20;
const DEFAULT_LEVELS = 10;

const BACK_ACTION = 'create_grid:back';
const CANCEL_ACTION = 'create_grid:cancel';

export class QuickStartStep {
    constructor(private readonly hyperliquidClient: HyperliquidInfoClient) {}

    async enter(ctx: WizardContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [
                { text: '← Back', action: BACK_ACTION },
                { text: '❌ Cancel', action: CANCEL_ACTION },
            ],
        ];

        await ctx.reply(
            `How much USDC do you want to invest?\n\nMinimum: ${MIN_INVESTMENT} USDC`,
            keyboard,
        );
    }

    async handleInvestmentInput(
        ctx: WizardContext,
        text: string,
    ): Promise<'preview' | 'invalid' | null> {
        const session = ctx.getSession();
        if (!session.createGrid?.symbol) {
            return null;
        }

        const investment = parseFloat(text);

        if (isNaN(investment) || investment < MIN_INVESTMENT) {
            await ctx.reply(
                `❌ Invalid amount. Minimum investment: ${MIN_INVESTMENT} USDC\n\nPlease enter a valid amount:`,
            );
            return 'invalid';
        }

        try {
            const tradingSymbol = TradingSymbol.fromString(session.createGrid.symbol);
            const price = await this.hyperliquidClient.getCurrentPrice(tradingSymbol);
            const currentPrice = price.toNumber();
            const priceOffset = currentPrice * (PRICE_RANGE_PERCENT / 100);

            session.createGrid.totalInvestmentUSDC = investment;
            session.createGrid.upperPrice = currentPrice + priceOffset;
            session.createGrid.lowerPrice = currentPrice - priceOffset;
            session.createGrid.levels = DEFAULT_LEVELS;

            await ctx.reply(
                `✅ Configuration:\n\n` +
                    `💰 Investment: ${investment} USDC\n` +
                    `📊 Price range: ${session.createGrid.lowerPrice.toFixed(4)} - ${session.createGrid.upperPrice.toFixed(4)}\n` +
                    `🎚 Levels: ${DEFAULT_LEVELS}\n` +
                    `💹 Current price: ${currentPrice.toFixed(4)}`,
            );

            return 'preview';
        } catch (error) {
            await ctx.reply(
                `❌ Failed to fetch current price for ${session.createGrid.symbol}. Please try again later.`,
            );
            return 'invalid';
        }
    }

    async handleBack(ctx: WizardContext): Promise<void> {
        const session = ctx.getSession();
        if (session.createGrid) {
            delete session.createGrid.mode;
        }
    }

    async handleCancel(ctx: WizardContext): Promise<void> {
        await ctx.leaveScene();
        await ctx.reply('❌ Grid creation cancelled');
    }
}
