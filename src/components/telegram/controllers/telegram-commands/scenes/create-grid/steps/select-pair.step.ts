import { WizardContext } from '../../../../../core/domain/wizard-context';
import { InlineButton } from '../../../../../core/domain/inline-button';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { TradingSymbol } from '@domain/primitives/trading-symbol';

const POPULAR_PAIRS = ['HYPE', 'BTC', 'ETH', 'SOL'];
const OTHER_PAIR_ACTION = 'create_grid:other_pair';
const CANCEL_ACTION = 'create_grid:cancel';

export class SelectPairStep {
    constructor(private readonly hyperliquidClient: HyperliquidInfoClient) {}

    async enter(ctx: WizardContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            ...POPULAR_PAIRS.map((pair) => [{ text: pair, action: `create_grid:pair:${pair}` }]),
            [{ text: '🔍 Other pair', action: OTHER_PAIR_ACTION }],
            [{ text: '❌ Cancel', action: CANCEL_ACTION }],
        ];

        await ctx.reply('Select trading pair:', keyboard);
    }

    async handlePairSelection(ctx: WizardContext, symbol: string): Promise<'mode' | 'invalid'> {
        try {
            const tradingSymbol = TradingSymbol.fromString(symbol);
            const exists = await this.hyperliquidClient.pairExists(tradingSymbol);

            if (!exists) {
                await ctx.reply(`❌ Pair ${symbol} not found. Please try another symbol.`);
                return 'invalid';
            }

            ctx.getSession().createGrid = { symbol };
            await ctx.reply(`✅ Selected: ${symbol}`);
            return 'mode';
        } catch (error) {
            await ctx.reply(`❌ Invalid symbol format. Please try another symbol.`);
            return 'invalid';
        }
    }

    async handleOtherPair(ctx: WizardContext): Promise<void> {
        await ctx.reply('Enter trading pair symbol (e.g., HYPE, BTC, ETH):');
    }

    async handleTextInput(ctx: WizardContext, text: string): Promise<'mode' | 'invalid' | null> {
        const session = ctx.getSession();
        if (!session.createGrid) {
            return null;
        }

        const symbol = text.trim().toUpperCase();
        return await this.handlePairSelection(ctx, symbol);
    }

    async handleCancel(ctx: WizardContext): Promise<void> {
        await ctx.leaveScene();
        await ctx.reply('❌ Grid creation cancelled');
    }
}
