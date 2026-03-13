import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { EMOJI } from '../../constants/emoji';
import { formatToken } from '../../formatters/format-token';
import { formatPrice } from '../../formatters/format-price';

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

export class TradeOpenedMessage {
    readonly text: string;

    private constructor(props: TradeOpenedProps) {
        const arrow = props.side === 'buy' ? EMOJI.ARROW_DOWN : EMOJI.ARROW_UP;
        const shortId = props.gridId.slice(0, 8);
        this.text =
            `${arrow} <b>${props.side.toUpperCase()} ${props.symbol}</b>\n` +
            `${formatToken(props.amount)} × ${formatPrice(props.price)} = ${formatPrice(props.total)}\n` +
            `Grid (<code>${shortId}</code>) · Lv.${props.level}/${props.totalLevels}`;
    }

    static create(props: TradeOpenedProps): TradeOpenedMessage {
        return new TradeOpenedMessage(props);
    }

    static fromEvent(event: OrderOpenedEvent): TradeOpenedMessage {
        return TradeOpenedMessage.create(event);
    }
}
