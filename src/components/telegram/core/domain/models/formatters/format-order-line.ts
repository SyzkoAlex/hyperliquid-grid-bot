import { OrderSide } from '@domain/models/order/order-side';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { PriceFormatter } from './price.formatter';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';

const ORDER_SIDE_EMOJI: Record<string, string> = {
    [OrderSide.Buy]: EMOJI.ARROW_DOWN,
    [OrderSide.Sell]: EMOJI.ARROW_UP,
};

export function formatOrderLine(order: OrderDto, symbol: string): string {
    const sideEmoji = ORDER_SIDE_EMOJI[order.side] ?? '·';
    const side = order.side === OrderSide.Buy ? 'Buy ' : 'Sell';
    const p = order.price !== null ? `$${PriceFormatter.format(order.price)}` : '—';
    return `${sideEmoji} ${side}  Lv.${order.levelIndex + 1}  ${p} · ${order.amount} ${symbol}`;
}
