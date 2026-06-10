import { EMOJI } from '../../constants/emoji';
import { formatFiat } from '../../formatters/format-fiat';
import { escapeHtml } from '../../formatters/escape-html';
import { OptimalSwapDto, SwapSide } from '@components/trading/api/dto/optimal-swap.dto';

export function swapHintLine(symbol: string, swap: OptimalSwapDto | null): string | null {
    if (!swap) return null;
    const safeSymbol = escapeHtml(symbol);
    const amount = formatFiat(swap.amountUsdc);
    if (swap.side === SwapSide.UsdcToBase) {
        const expected = swap.expectedReceived.toFixed(6);
        return `${EMOJI.BULB} Tip: swap ~${amount} USDC → ~${expected} ${safeSymbol} to fit this grid.`;
    }
    const expected = formatFiat(swap.expectedReceived);
    return `${EMOJI.BULB} Tip: swap ~${swap.amountUsdc.toFixed(6)} ${safeSymbol} → ~${expected} USDC to fit this grid.`;
}
