import { TelegramMessage } from './telegram-message';
import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';
import { EMOJI } from '../constants/emoji.constants';
import { formatFiat } from '../formatters/format-fiat';

interface TradeClosedProps {
    gridId: string;
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
        const arrow = props.side === 'buy' ? EMOJI.ARROW_DOWN : EMOJI.ARROW_UP;
        const shortId = props.gridId.slice(0, 8);
        const profitSign = props.profit >= 0 ? '+' : '';
        this.text =
            `${arrow} <b>${props.side.toUpperCase()} ${props.amount} ${props.symbol}</b> @ $${props.price}\n` +
            `$${formatFiat(props.total)} · Profit: ${profitSign}$${formatFiat(props.profit)} (${props.profitPercent}%)\n` +
            `Grid (<code>${shortId}</code>) · Lv.${props.level}/${props.totalLevels}`;
    }

    static fromEvent(event: OrderClosedEvent): TradeClosedMessage {
        return new TradeClosedMessage({
            gridId: event.gridId,
            symbol: event.symbol,
            side: event.side,
            price: event.price,
            amount: event.amount,
            total: event.total,
            profit: event.profit,
            profitPercent: ((event.profit / event.total) * 100).toFixed(2),
            level: event.level,
            totalLevels: event.totalLevels,
        });
    }
}
