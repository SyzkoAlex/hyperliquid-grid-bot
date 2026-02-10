import { TelegramMessage } from './telegram-message';
import { GridCreatedSuccessEvent } from '@domain/events/trading/grid-created-success.event';

interface GridCreatedSuccessProps {
    gridId: string;
    symbol: string;
    mode: string;
    lowerPrice: number;
    upperPrice: number;
    levels: number;
    investmentUSDC: number;
    investmentBase: number;
    trailingEnabled: boolean;
}

export class GridCreatedSuccessMessage extends TelegramMessage {
    protected readonly text: string;

    constructor(props: GridCreatedSuccessProps) {
        super();
        this.text =
            `✅ <b>Grid Created!</b>\n\n` +
            `<b>Symbol:</b> ${props.symbol}\n` +
            `<b>Range:</b> $${props.lowerPrice.toLocaleString()} - $${props.upperPrice.toLocaleString()}\n` +
            `<b>Levels:</b> ${props.levels}\n` +
            `<b>Mode:</b> ${props.mode}\n\n` +
            `<b>Capital:</b>\n` +
            `• USDC: $${props.investmentUSDC.toLocaleString()}\n` +
            `• ${props.symbol}: ${props.investmentBase.toFixed(4)}\n\n` +
            `${props.trailingEnabled ? '🚀 <b>Trailing:</b> ON (5% trigger, 10% step)\n\n' : ''}` +
            `<b>Orders:</b> Placed successfully\n` +
            `<b>Grid ID:</b> <code>${props.gridId}</code>\n\n` +
            `Grid is now active and will trade automatically!`;
    }

    static fromEvent(event: GridCreatedSuccessEvent): GridCreatedSuccessMessage {
        return new GridCreatedSuccessMessage({
            gridId: event.gridId,
            symbol: event.symbol,
            mode: event.mode,
            lowerPrice: event.lowerPrice,
            upperPrice: event.upperPrice,
            levels: event.levels,
            investmentUSDC: event.investmentUSDC,
            investmentBase: event.investmentBase,
            trailingEnabled: event.trailingEnabled,
        });
    }
}
