import { TelegramMessage } from './telegram-message';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { EMOJI } from '../constants/emoji.constants';
import { formatFiat } from '../formatters/format-fiat';

interface TradeOpenedProps {
    gridId: string;
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
        const arrow = props.side === 'buy' ? EMOJI.ARROW_DOWN : EMOJI.ARROW_UP;
        const shortId = props.gridId.slice(0, 8);
        this.text =
            `${arrow} <b>${props.side.toUpperCase()} ${props.amount} ${props.symbol}</b> @ $${props.price}\n` +
            `Total: $${formatFiat(props.total)}\n` +
            `Grid (<code>${shortId}</code>) · Lv.${props.level}/${props.totalLevels}`;
    }

    static fromEvent(event: OrderOpenedEvent): TradeOpenedMessage {
        return new TradeOpenedMessage({
            gridId: event.gridId,
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
