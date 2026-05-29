import { describe, it, expect } from 'vitest';
import { SwapMessages } from './swap.messages';
import { SwapSide } from '@components/trading/api/dto/optimal-swap.dto';

describe('SwapMessages', () => {
    describe('offer', () => {
        it('escapes HTML special characters in the symbol', () => {
            const result = SwapMessages.offer('<script>', {
                side: SwapSide.UsdcToBase,
                amountUsdc: 100,
                expectedReceived: 5,
            });

            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        it('renders UsdcToBase offer with USDC on the left and base on the right', () => {
            const result = SwapMessages.offer('HYPE', {
                side: SwapSide.UsdcToBase,
                amountUsdc: 200,
                expectedReceived: 6.5,
            });

            expect(result).toContain('USDC');
            expect(result).toContain('HYPE');
            expect(result).toContain('200.00');
            expect(result).toContain('6.500000');
            expect(result).toContain('→');
        });

        it('renders BaseToUsdc offer with base on the left and USDC on the right', () => {
            const result = SwapMessages.offer('HYPE', {
                side: SwapSide.BaseToUsdc,
                amountUsdc: 3.5,
                expectedReceived: 70,
            });

            expect(result).toContain('HYPE');
            expect(result).toContain('USDC');
            expect(result).toContain('3.500000');
            expect(result).toContain('70.00');
            expect(result).toContain('→');
        });

        it('includes price-movement warning for UsdcToBase offer', () => {
            const result = SwapMessages.offer('HYPE', {
                side: SwapSide.UsdcToBase,
                amountUsdc: 100,
                expectedReceived: 5,
            });

            expect(result).toContain('Price may move');
            expect(result).toContain('market price');
        });

        it('includes price-movement warning for BaseToUsdc offer', () => {
            const result = SwapMessages.offer('HYPE', {
                side: SwapSide.BaseToUsdc,
                amountUsdc: 100,
                expectedReceived: 5,
            });

            expect(result).toContain('Price may move');
            expect(result).toContain('market price');
        });
    });

    describe('executing', () => {
        it('returns a waiting message', () => {
            const result = SwapMessages.executing();

            expect(result).toContain('please wait');
        });
    });

    describe('successUsdcToBase', () => {
        it('mentions Bought for UsdcToBase direction', () => {
            const result = SwapMessages.successUsdcToBase('HYPE', 6.5, 200);

            expect(result).toContain('Bought');
            expect(result).toContain('HYPE');
            expect(result).toContain('200.00');
        });

        it('escapes HTML special characters in symbol', () => {
            const result = SwapMessages.successUsdcToBase('<b>', 1, 20);

            expect(result).not.toContain('<b>');
            expect(result).toContain('&lt;b&gt;');
        });
    });

    describe('successBaseToUsdc', () => {
        it('mentions Sold for BaseToUsdc direction', () => {
            const result = SwapMessages.successBaseToUsdc('HYPE', 3.5, 70);

            expect(result).toContain('Sold');
            expect(result).toContain('HYPE');
            expect(result).toContain('70.00');
        });

        it('escapes HTML special characters in symbol', () => {
            const result = SwapMessages.successBaseToUsdc('<b>', 1, 20);

            expect(result).not.toContain('<b>');
            expect(result).toContain('&lt;b&gt;');
        });
    });

    describe('sessionExpired', () => {
        it('contains session expired text', () => {
            const result = SwapMessages.sessionExpired();

            expect(result).toContain('Session expired');
        });
    });

    describe('failed', () => {
        it('includes the error message in the output', () => {
            const result = SwapMessages.failed('Order rejected by exchange');

            expect(result).toContain('Order rejected by exchange');
        });
    });

    describe('proactiveHint', () => {
        it('includes max without swap line for UsdcToBase offer', () => {
            const result = SwapMessages.proactiveHint(
                'HYPE',
                { side: SwapSide.UsdcToBase, amountUsdc: 2801, expectedReceived: 52 },
                1896,
                7498,
            );

            expect(result).toContain('Max without swap: ~1,896 USDC');
        });

        it('shows swap direction USDC to base token with up-to total', () => {
            const result = SwapMessages.proactiveHint(
                'HYPE',
                { side: SwapSide.UsdcToBase, amountUsdc: 2801, expectedReceived: 52 },
                1896,
                7498,
            );

            expect(result).toContain('2,801.00 USDC');
            expect(result).toContain('52.00 HYPE');
            expect(result).toContain('7,498 USDC');
        });

        it('shows swap direction base to USDC for BaseToUsdc offer', () => {
            const result = SwapMessages.proactiveHint(
                'HYPE',
                { side: SwapSide.BaseToUsdc, amountUsdc: 5.5, expectedReceived: 110 },
                900,
                2000,
            );

            expect(result).toContain('5.50 HYPE');
            expect(result).toContain('110.00 USDC');
            expect(result).toContain('~2,000 USDC');
        });

        it('escapes HTML special characters in symbol', () => {
            const result = SwapMessages.proactiveHint(
                '<b>',
                { side: SwapSide.UsdcToBase, amountUsdc: 100, expectedReceived: 5 },
                500,
                1000,
            );

            expect(result).not.toContain('<b>');
            expect(result).toContain('&lt;b&gt;');
        });

        it('includes max without swap line for BaseToUsdc offer', () => {
            const result = SwapMessages.proactiveHint(
                'HYPE',
                { side: SwapSide.BaseToUsdc, amountUsdc: 5.5, expectedReceived: 110 },
                900,
                2000,
            );

            expect(result).toContain('Max without swap: ~900 USDC');
        });
    });
});
