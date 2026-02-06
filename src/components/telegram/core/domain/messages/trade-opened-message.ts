import { TelegramMessage } from './telegram-message';

interface TradeOpenedProps {
    symbol: string;
    side: string;
    price: number;
    amount: number;
    total: number;
    level: number;
    totalLevels: number;
}

export class TradeOpenedMessage extends TelegramMessage {
    protected readonly text: string;

    constructor(props: TradeOpenedProps) {
        super();
        this.text =
            `🟢 <b>Order Filled (${props.side.toUpperCase()})</b>\n\n` +
            `<b>Symbol:</b> ${props.symbol}\n` +
            `<b>Price:</b> $${props.price}\n` +
            `<b>Amount:</b> ${props.amount}\n` +
            `<b>Total:</b> $${props.total}\n\n` +
            `<b>Grid Level:</b> ${props.level}/${props.totalLevels}\n` +
            `<b>Status:</b> ✅ Active`;
    }
}
