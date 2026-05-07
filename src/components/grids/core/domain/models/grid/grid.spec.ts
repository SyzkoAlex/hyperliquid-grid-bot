import { describe, it, expect } from 'vitest';
import { Grid } from './grid';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';

const makeBaseParams = () => ({
    userId: 'user-1',
    symbol: TradingSymbol.create('ETH'),
    lowerPrice: Price.from(2000),
    upperPrice: Price.from(3000),
    levels: 10,
    investmentUSDC: Decimal.from(1000),
    investmentBase: Decimal.from(0),
});

describe('Grid.validate', () => {
    describe('stop-loss validation', () => {
        it('throws when stopLossEnabled but stopLossPrice is missing', () => {
            expect(() =>
                Grid.create({
                    ...makeBaseParams(),
                    stopLossEnabled: true,
                }),
            ).toThrow('Stop-loss enabled but stopLossPrice missing');
        });

        it('throws when stopLossPrice >= lowerPrice', () => {
            expect(() =>
                Grid.create({
                    ...makeBaseParams(),
                    stopLossEnabled: true,
                    stopLossPrice: Price.from(2000),
                }),
            ).toThrow('Stop-loss price must be strictly below lower price');
        });

        it('throws when stopLossPrice is less than 0.5% below lowerPrice', () => {
            // 0.4% below lowerPrice: 2000 * 0.996 = 1992 which is > 2000 * 0.995 = 1990
            expect(() =>
                Grid.create({
                    ...makeBaseParams(),
                    stopLossEnabled: true,
                    stopLossPrice: Price.from(1992),
                }),
            ).toThrow('Stop-loss price must be at least 0.5% below lower price');
        });

        it('accepts stopLossPrice exactly at the 0.5% boundary (inclusive lower bound is rejected)', () => {
            // Exactly 0.5% below: 2000 * 0.995 = 1990 — this equals minBuffer so should throw
            expect(() =>
                Grid.create({
                    ...makeBaseParams(),
                    stopLossEnabled: true,
                    stopLossPrice: Price.from(1990),
                }),
            ).toThrow('Stop-loss price must be at least 0.5% below lower price');
        });

        it('accepts stopLossPrice more than 0.5% below lowerPrice', () => {
            // 1% below: 2000 * 0.99 = 1980 — valid
            expect(() =>
                Grid.create({
                    ...makeBaseParams(),
                    stopLossEnabled: true,
                    stopLossPrice: Price.from(1980),
                }),
            ).not.toThrow();
        });

        it('accepts a grid without stop-loss', () => {
            expect(() =>
                Grid.create({
                    ...makeBaseParams(),
                    stopLossEnabled: false,
                }),
            ).not.toThrow();
        });
    });
});
