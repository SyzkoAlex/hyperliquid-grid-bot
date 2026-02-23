import { TelegramMessage } from './telegram-message';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';

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

    static fromEvent(event: OrderOpenedEvent): TradeOpenedMessage {
        return new TradeOpenedMessage({
            symbol: event.symbol,
            side: event.side,
            price: event.price,
            amount: event.amount,
            total: event.total,
            level: event.level,
            totalLevels: event.totalLevels,
        });
    }
}
