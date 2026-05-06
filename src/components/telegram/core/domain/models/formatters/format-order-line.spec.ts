import { describe, expect, it } from 'vitest';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { formatOrderLine } from './format-order-line';

const baseOrder: OrderDto = {
    id: 'o1',
    gridId: 'g1',
    symbol: 'ETH',
    side: OrderSide.Buy,
    status: OrderStatus.Placed,
    type: OrderType.Limit,
    levelIndex: 4,
    price: 90,
    amount: 0.1,
    exchangeOrderId: null,
    createdAt: 0,
};

describe('formatOrderLine', () => {
    it('does not render a level number', () => {
        expect(formatOrderLine(baseOrder, 'ETH')).not.toContain('Lv.');
    });

    it('renders side, price, amount, and symbol', () => {
        const result = formatOrderLine(baseOrder, 'ETH');
        expect(result).toContain('Buy');
        expect(result).toContain('$90');
        expect(result).toContain('0.1 ETH');
    });

    it('renders buy side with down arrow', () => {
        const result = formatOrderLine(baseOrder, 'ETH');
        expect(result).toContain('▼');
        expect(result).toContain('Buy');
    });

    it('renders sell side with up arrow', () => {
        const sell = { ...baseOrder, side: OrderSide.Sell, price: 110 };
        const result = formatOrderLine(sell, 'ETH');
        expect(result).toContain('▲');
        expect(result).toContain('Sell');
    });

    it('renders em-dash when price is null', () => {
        const order = { ...baseOrder, price: null };
        expect(formatOrderLine(order, 'ETH')).toContain('—');
    });
});
