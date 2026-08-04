import { describe, it, expect } from 'vitest';
import { swapHintLine } from './swap-hint';
import { SwapSide } from '@components/trading/api/dto/optimal-swap.dto';

describe('swapHintLine', () => {
    it('returns null when swap is null', () => {
        expect(swapHintLine('HYPE', null, 20)).toBeNull();
    });

    it('formats UsdcToBase hint correctly', () => {
        const result = swapHintLine(
            'HYPE',
            {
                side: SwapSide.UsdcToBase,
                amountUsdc: 1234.56,
                expectedReceived: 6.54321,
            },
            188.7,
        );
        expect(result).toBe('💡 Tip: swap ~1,234.56 USDC → ~6.543210 HYPE to fit this grid.');
    });

    it('formats BaseToUsdc hint correctly, converting the USDC-denominated amount to a base-token quantity via currentPrice', () => {
        const result = swapHintLine(
            'HYPE',
            {
                side: SwapSide.BaseToUsdc,
                amountUsdc: 12.3456789,
                expectedReceived: 12.34,
            },
            10,
        );
        // 12.3456789 USDC worth of HYPE at $10/HYPE = 1.23456789 HYPE.
        expect(result).toBe('💡 Tip: swap ~1.234568 HYPE → ~12.34 USDC to fit this grid.');
    });
});
