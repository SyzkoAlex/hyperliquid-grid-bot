import { describe, expect, it } from 'vitest';
import { GridCreatedSuccessMessage } from './grid-created-success-message';
import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';

describe('GridCreatedSuccessMessage', () => {
    const baseProps = {
        gridId: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTC',
        mode: 'neutral',
        lowerPrice: 90000,
        upperPrice: 100000,
        levels: 10,
        investmentUSDC: 500,
        investmentBase: 0.005,
        trailingEnabled: false,
    };

    it('contains symbol, range, levels, and capital', () => {
        const msg = GridCreatedSuccessMessage.create(baseProps);
        expect(msg.text).toContain('BTC');
        expect(msg.text).toContain('$90,000');
        expect(msg.text).toContain('$100,000');
        expect(msg.text).toContain('10');
        expect(msg.text).toContain('$500');
        expect(msg.text).toContain('0.0050');
    });

    it('shows grid ID', () => {
        const msg = GridCreatedSuccessMessage.create(baseProps);
        expect(msg.text).toContain('550e8400-e29b-41d4-a716-446655440000');
    });

    it('omits trailing section when disabled', () => {
        const msg = GridCreatedSuccessMessage.create(baseProps);
        expect(msg.text).not.toContain('Trailing');
    });

    it('shows trailing section when enabled', () => {
        const msg = GridCreatedSuccessMessage.create({ ...baseProps, trailingEnabled: true });
        expect(msg.text).toContain('Trailing');
        expect(msg.text).toContain('ON');
    });

    it('creates from GridCreatedSuccessEvent', () => {
        const event = new GridCreatedSuccessEvent(
            'abcdef01-2345-6789-abcd-ef0123456789',
            'ETH',
            3000,
            4000,
            20,
            1000,
            0.3,
            true,
        );
        const msg = GridCreatedSuccessMessage.fromEvent(event);
        expect(msg.text).toContain('ETH');
        expect(msg.text).toContain('$3,000');
        expect(msg.text).toContain('$4,000');
        expect(msg.text).toContain('20');
        expect(msg.text).toContain('Trailing');
    });
});
