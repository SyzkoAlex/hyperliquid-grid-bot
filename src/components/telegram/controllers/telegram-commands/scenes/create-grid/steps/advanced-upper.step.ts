import { WizardContext } from '../../../../../core/domain/wizard-context';
import { InlineButton } from '../../../../../core/domain/inline-button';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { TradingSymbol } from '@domain/primitives/trading-symbol';

const BACK_ACTION = 'create_grid:back';
const CANCEL_ACTION = 'create_grid:cancel';

export class AdvancedUpperStep {
    constructor(private readonly hyperliquidClient: HyperliquidInfoClient) {}

    async enter(ctx: WizardContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [
                { text: '← Back', action: BACK_ACTION },
                { text: '❌ Cancel', action: CANCEL_ACTION },
            ],
        ];

        const session = ctx.getSession();
        let message = 'Enter upper price for the grid:';
        if (session.createGrid?.symbol) {
            try {
                const tradingSymbol = TradingSymbol.fromString(session.createGrid.symbol);
                const price = await this.hyperliquidClient.getCurrentPrice(tradingSymbol);
                const currentPrice = price.toNumber();
                message += `\n\nCurrent ${session.createGrid.symbol} price: ${currentPrice.toFixed(4)}`;
            } catch (error) {
                message += `\n\n⚠️ Could not fetch current price`;
            }
        }

        await ctx.reply(message, keyboard);
    }

    async handlePriceInput(ctx: WizardContext, text: string): Promise<'lower' | 'invalid' | null> {
        const session = ctx.getSession();
        if (!session.createGrid) {
            return null;
        }

        const price = parseFloat(text);

        if (isNaN(price) || price <= 0) {
            await ctx.reply('❌ Invalid price. Please enter a positive number:');
            return 'invalid';
        }

        session.createGrid.upperPrice = price;
        await ctx.reply(`✅ Upper price set: ${price.toFixed(4)}`);
        return 'lower';
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
