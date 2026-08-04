import { EMOJI } from '../../constants/emoji';
import { formatFiat } from '../../formatters/format-fiat';
import { escapeHtml } from '../../formatters/escape-html';
import { OptimalSwapDto, SwapSide } from '@components/trading/api/dto/optimal-swap.dto';
import { baseQuantityFromUsdc } from './swap-amount';

export function swapHintLine(
    symbol: string,
    swap: OptimalSwapDto | null,
    currentPrice: number,
): string | null {
    if (!swap) return null;
    const safeSymbol = escapeHtml(symbol);
    if (swap.side === SwapSide.UsdcToBase) {
        const amount = formatFiat(swap.amountUsdc);
        const expected = swap.expectedReceived.toFixed(6);
        return `${EMOJI.BULB} Tip: swap ~${amount} USDC → ~${expected} ${safeSymbol} to fit this grid.`;
    }
    const baseAmount = baseQuantityFromUsdc(swap.amountUsdc, currentPrice);
    const expected = formatFiat(swap.expectedReceived);
    return `${EMOJI.BULB} Tip: swap ~${baseAmount} ${safeSymbol} → ~${expected} USDC to fit this grid.`;
}
