import { TelegramMessage } from './telegram-message';

interface TradeClosedProps {
    symbol: string;
    side: string;
    price: number;
    amount: number;
    total: number;
    profit: number;
    profitPercent: string;
    level: number;
    totalLevels: number;
}

export class TradeClosedMessage extends TelegramMessage {
    protected readonly text: string;

    constructor(props: TradeClosedProps) {
        super();
        this.text =
            `🔴 <b>Order Filled (${props.side.toUpperCase()})</b>\n\n` +
            `<b>Symbol:</b> ${props.symbol}\n` +
            `<b>Price:</b> $${props.price}\n` +
            `<b>Amount:</b> ${props.amount}\n` +
            `<b>Total:</b> $${props.total}\n\n` +
            `<b>Profit:</b> ${props.profit >= 0 ? '+' : ''}$${props.profit} (${props.profitPercent}%)\n` +
            `<b>Grid Level:</b> ${props.level}/${props.totalLevels}\n` +
            `<b>Status:</b> ✅ Active`;
    }
}
