import { describe, expect, it } from 'vitest';
import { TradeClosedMessage } from './trade-closed-message';
import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';

describe('TradeClosedMessage', () => {
    const baseProps = {
        gridId: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTC',
        side: 'sell',
        price: 96000,
        amount: 0.005,
        total: 480,
        profit: 5,
        profitPercent: '1.04',
        level: 3,
        totalLevels: 10,
    };

    it('shows positive profit with + sign', () => {
        const msg = TradeClosedMessage.create(baseProps);
        expect(msg.text).toContain('+$5.00');
        expect(msg.text).toContain('1.04%');
    });

    it('shows negative profit without + sign', () => {
        const msg = TradeClosedMessage.create({
            ...baseProps,
            profit: -2.5,
            profitPercent: '-0.52',
        });
        expect(msg.text).toContain('$-2.50');
        expect(msg.text).not.toContain('+$-2.50');
        expect(msg.text).toContain('-0.52%');
    });

    it('contains symbol, formatted price/amount/total, and level info', () => {
        const msg = TradeClosedMessage.create(baseProps);
        expect(msg.text).toContain('SELL BTC');
        expect(msg.text).toContain('0.005');
        expect(msg.text).toContain('$96,000.00');
        expect(msg.text).toContain('$480.00');
        expect(msg.text).toContain('550e8400');
        expect(msg.text).toContain('Lv.3/10');
    });

    it('creates from OrderClosedEvent and computes profitPercent', () => {
        const event = new OrderClosedEvent(
            'abcdef01-2345-6789-abcd-ef0123456789',
            'ETH',
            'buy',
            3400,
            0.15,
            510,
            7.65,
            2,
            8,
        );
        const msg = TradeClosedMessage.fromEvent(event);
        expect(msg.text).toContain('▼');
        expect(msg.text).toContain('BUY ETH');
        expect(msg.text).toContain('+$7.65');
        expect(msg.text).toContain('1.50%');
        expect(msg.text).toContain('Lv.2/8');
    });

    it('computes negative profitPercent from event', () => {
        const event = new OrderClosedEvent(
            'abcdef01-2345-6789-abcd-ef0123456789',
            'BTC',
            'sell',
            95000,
            0.01,
            950,
            -4.75,
            5,
            10,
        );
        const msg = TradeClosedMessage.fromEvent(event);
        expect(msg.text).toContain('$-4.75');
        expect(msg.text).toContain('-0.50%');
    });
});
