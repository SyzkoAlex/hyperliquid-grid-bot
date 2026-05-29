import { EMOJI } from '../../constants/emoji';
import { formatFiat } from '../../formatters/format-fiat';
import { escapeHtml } from '../../formatters/escape-html';
import { OptimalSwapDto, SwapSide } from '@components/trading/api/dto/optimal-swap.dto';

function formatRoundedUsdc(n: number): string {
    return Math.round(n).toLocaleString('en-US');
}

export class SwapMessages {
    static offer(symbol: string, offer: OptimalSwapDto): string {
        const s = escapeHtml(symbol);
        if (offer.side === SwapSide.UsdcToBase) {
            return (
                `${EMOJI.REFRESH} Swap ~${formatFiat(offer.amountUsdc)} USDC → ~${offer.expectedReceived.toFixed(6)} ${s}?\n\n` +
                `This converts part of your USDC balance to ${s} to fit the grid.\n\n` +
                `${EMOJI.WARNING} Price may move during execution; the order fills at the current market price.`
            );
        }
        return (
            `${EMOJI.REFRESH} Swap ~${offer.amountUsdc.toFixed(6)} ${s} → ~${formatFiat(offer.expectedReceived)} USDC?\n\n` +
            `This converts part of your ${s} balance to USDC to fit the grid.\n\n` +
            `${EMOJI.WARNING} Price may move during execution; the order fills at the current market price.`
        );
    }

    static executing(): string {
        return `${EMOJI.HOURGLASS} Swapping... please wait.`;
    }

    static successUsdcToBase(symbol: string, filledBase: number, notionalUsdc: number): string {
        const s = escapeHtml(symbol);
        return (
            `${EMOJI.SUCCESS} Swap complete!\n\n` +
            `Bought ~${filledBase.toFixed(6)} ${s} for ~${formatFiat(notionalUsdc)} USDC.`
        );
    }

    static successBaseToUsdc(symbol: string, filledBase: number, notionalUsdc: number): string {
        const s = escapeHtml(symbol);
        return (
            `${EMOJI.SUCCESS} Swap complete!\n\n` +
            `Sold ~${filledBase.toFixed(6)} ${s} for ~${formatFiat(notionalUsdc)} USDC.`
        );
    }

    static failed(errorMessage: string): string {
        return `${EMOJI.ERROR} Swap failed: ${errorMessage}`;
    }

    static sessionExpired(): string {
        return `${EMOJI.ERROR} Session expired. Please go back and try again.`;
    }

    /**
     * Shown on the normal balance screen (maximize-mode) when the portfolio is imbalanced —
     * hints at a swap that would let the user invest more. This is distinct from offer() which
     * renders the full swap confirmation dialog.
     *
     * NOTE: toFixed(2) here is intentional — this is a hint line where rough precision is
     * sufficient. offer() uses toFixed(6) for the confirmation dialog where exact amounts matter.
     */
    static proactiveHint(
        symbol: string,
        swapOffer: OptimalSwapDto,
        maxWithoutSwap: number,
        totalAvailable: number,
    ): string {
        const total = formatRoundedUsdc(totalAvailable);
        const maxLine = `${EMOJI.LIGHTNING} Max without swap: ~${formatRoundedUsdc(maxWithoutSwap)} USDC`;
        if (swapOffer.side === SwapSide.UsdcToBase) {
            const amount = formatFiat(swapOffer.amountUsdc);
            const received = swapOffer.expectedReceived.toFixed(2);
            return `${maxLine}\n${EMOJI.BULB} Swap ~${amount} USDC → ~${received} ${escapeHtml(symbol)} to invest up to ~${total} USDC`;
        }
        const amount = swapOffer.amountUsdc.toFixed(2);
        const received = formatFiat(swapOffer.expectedReceived);
        return `${maxLine}\n${EMOJI.BULB} Swap ~${amount} ${escapeHtml(symbol)} → ~${received} USDC to invest up to ~${total} USDC`;
    }
}
