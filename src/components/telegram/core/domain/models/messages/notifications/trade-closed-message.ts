import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';
import { EMOJI } from '../../constants/emoji';
import { formatToken } from '../../formatters/format-token';
import { formatPrice } from '../../formatters/format-price';

interface TradeClosedProps {
    gridId: string;
    symbol: string;
    side: string;
    price: number;
    amount: number;
    total: number;
    profit: number;
    profitPercent: string;
}

export class TradeClosedMessage {
    readonly text: string;

    private constructor(props: TradeClosedProps) {
        const arrow = props.side === 'buy' ? EMOJI.ARROW_DOWN : EMOJI.ARROW_UP;
        const shortId = props.gridId.slice(0, 8);
        const profitSign = props.profit >= 0 ? '+' : '';
        this.text =
            `${arrow} <b>${props.side.toUpperCase()} ${props.symbol}</b>\n` +
            `${formatToken(props.amount)} × ${formatPrice(props.price)} = ${formatPrice(props.total)}\n` +
            `Profit: ${profitSign}${formatPrice(props.profit)} (${props.profitPercent}%)\n` +
            `Grid (<code>${shortId}</code>)`;
    }

    static create(props: TradeClosedProps): TradeClosedMessage {
        return new TradeClosedMessage(props);
    }

    static fromEvent(event: OrderClosedEvent): TradeClosedMessage {
        return TradeClosedMessage.create({
            gridId: event.gridId,
            symbol: event.symbol,
            side: event.side,
            price: event.price,
            amount: event.amount,
            total: event.total,
            profit: event.profit,
            profitPercent: ((event.profit / event.total) * 100).toFixed(2),
        });
    }
}
