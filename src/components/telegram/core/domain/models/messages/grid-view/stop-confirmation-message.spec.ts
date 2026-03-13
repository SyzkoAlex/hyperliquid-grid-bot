import { describe, it, expect } from 'vitest';
import { StopConfirmationMessage } from './stop-confirmation-message';

const DEFAULT_PARAMS = {
    symbol: 'BTC',
    id: '550e8400-e29b-41d4-a716-446655440000',
    lowerPrice: 90000,
    upperPrice: 100000,
};

describe('StopConfirmationMessage', () => {
    it('contains stop warning', () => {
        const result = StopConfirmationMessage.create(DEFAULT_PARAMS);
        expect(result.text).toContain('Stop grid?');
    });

    it('shows symbol pair', () => {
        const result = StopConfirmationMessage.create(DEFAULT_PARAMS);
        expect(result.text).toContain('BTC/USDC');
    });

    it('shows first 8 chars of grid id', () => {
        const result = StopConfirmationMessage.create(DEFAULT_PARAMS);
        expect(result.text).toContain('550e8400');
        expect(result.text).not.toContain('550e8400-e29b');
    });

    it('shows price range', () => {
        const result = StopConfirmationMessage.create(DEFAULT_PARAMS);
        expect(result.text).toContain('90000');
        expect(result.text).toContain('100000');
    });

    it('mentions orders will be cancelled', () => {
        const result = StopConfirmationMessage.create(DEFAULT_PARAMS);
        expect(result.text).toContain('cancelled');
    });

    it('formats fractional prices correctly', () => {
        const result = StopConfirmationMessage.create({
            ...DEFAULT_PARAMS,
            lowerPrice: 0.85,
            upperPrice: 1.25,
        });
        expect(result.text).toContain('0.85');
        expect(result.text).toContain('1.25');
    });
});
