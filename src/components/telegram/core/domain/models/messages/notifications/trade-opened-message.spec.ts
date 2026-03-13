import { describe, expect, it } from 'vitest';
import { TradeOpenedMessage } from './trade-opened-message';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';

describe('TradeOpenedMessage', () => {
    const baseProps = {
        gridId: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTC',
        side: 'buy',
        price: 95000,
        amount: 0.005,
        total: 475,
        level: 3,
        totalLevels: 10,
    };

    it('shows down arrow for buy side', () => {
        const msg = TradeOpenedMessage.create(baseProps);
        expect(msg.text).toContain('▼');
        expect(msg.text).toContain('BUY BTC');
    });

    it('shows up arrow for sell side', () => {
        const msg = TradeOpenedMessage.create({ ...baseProps, side: 'sell' });
        expect(msg.text).toContain('▲');
        expect(msg.text).toContain('SELL BTC');
    });

    it('contains formatted price, amount, and total', () => {
        const msg = TradeOpenedMessage.create(baseProps);
        expect(msg.text).toContain('0.005');
        expect(msg.text).toContain('$95,000.00');
        expect(msg.text).toContain('$475.00');
    });

    it('shows first 8 chars of grid ID and level info', () => {
        const msg = TradeOpenedMessage.create(baseProps);
        expect(msg.text).toContain('550e8400');
        expect(msg.text).toContain('Lv.3/10');
    });

    it('creates from OrderOpenedEvent', () => {
        const event = new OrderOpenedEvent(
            '550e8400-e29b-41d4-a716-446655440000',
            'ETH',
            'sell',
            3500,
            0.15,
            525,
            2,
            8,
        );
        const msg = TradeOpenedMessage.fromEvent(event);
        expect(msg.text).toContain('▲');
        expect(msg.text).toContain('SELL ETH');
        expect(msg.text).toContain('$3,500.00');
        expect(msg.text).toContain('Lv.2/8');
    });
});
