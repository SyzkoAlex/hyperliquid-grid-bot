import { describe, it, expect } from 'vitest';
import { BalanceMessage } from './balance-message';
import { UserBalance } from '../user-balance';

function makeBalance(overrides: Partial<UserBalance> = {}): UserBalance {
    return {
        usdc: { available: 1000, inOrders: 200, total: 1200 },
        tokens: [],
        totalValueUsdc: 1200,
        ...overrides,
    };
}

describe('BalanceMessage', () => {
    it('shows USDC total', () => {
        const result = BalanceMessage.create(makeBalance());
        expect(result.text).toContain('1,200.00');
    });

    it('shows available and in-orders when inOrders > 0', () => {
        const result = BalanceMessage.create(makeBalance());
        expect(result.text).toContain('Available:');
        expect(result.text).toContain('In Orders:');
        expect(result.text).toContain('1,000.00');
        expect(result.text).toContain('200.00');
    });

    it('hides available/in-orders line when inOrders is 0', () => {
        const balance = makeBalance({ usdc: { available: 500, inOrders: 0, total: 500 } });
        const result = BalanceMessage.create(balance);
        expect(result.text).not.toContain('In Orders:');
    });

    it('shows portfolio total', () => {
        const result = BalanceMessage.create(makeBalance({ totalValueUsdc: 5432.1 }));
        expect(result.text).toContain('Portfolio:');
        expect(result.text).toContain('5,432.10');
    });

    it('shows token positions when present', () => {
        const balance = makeBalance({
            tokens: [
                {
                    symbol: 'BTC',
                    available: 0.5,
                    inOrders: 0,
                    total: 0.5,
                    price: 95000,
                    valueUsdc: 47500,
                },
            ],
        });
        const result = BalanceMessage.create(balance);
        expect(result.text).toContain('Positions:');
        expect(result.text).toContain('BTC:');
        expect(result.text).toContain('47,500.00');
    });

    it('shows token available/in-orders when inOrders > 0', () => {
        const balance = makeBalance({
            tokens: [
                {
                    symbol: 'ETH',
                    available: 2,
                    inOrders: 1,
                    total: 3,
                    price: 3000,
                    valueUsdc: 9000,
                },
            ],
        });
        const result = BalanceMessage.create(balance);
        expect(result.text).toContain('Available:');
        expect(result.text).toContain('In Orders:');
    });

    it('hides token available/in-orders when inOrders is 0', () => {
        const balance = makeBalance({
            tokens: [
                {
                    symbol: 'SOL',
                    available: 10,
                    inOrders: 0,
                    total: 10,
                    price: 150,
                    valueUsdc: 1500,
                },
            ],
        });
        const lines = BalanceMessage.create(balance).text.split('\n');
        const solLine = lines.findIndex((l) => l.includes('SOL:'));
        expect(lines[solLine + 1]).not.toContain('In Orders:');
    });

    it('does not show Positions section when no tokens', () => {
        const result = BalanceMessage.create(makeBalance({ tokens: [] }));
        expect(result.text).not.toContain('Positions:');
    });

    it('handles zero balances', () => {
        const balance = makeBalance({
            usdc: { available: 0, inOrders: 0, total: 0 },
            totalValueUsdc: 0,
        });
        const result = BalanceMessage.create(balance);
        expect(result.text).toContain('0.00');
        expect(result.text).toContain('Portfolio:');
    });
});
