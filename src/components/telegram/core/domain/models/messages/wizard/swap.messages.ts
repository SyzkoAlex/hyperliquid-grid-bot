import { EMOJI } from '../../constants/emoji';
import { formatFiat } from '../../formatters/format-fiat';
import { escapeHtml } from '../../formatters/escape-html';
import { SwapSide } from '@components/trading/api/dto/optimal-swap.dto';

export class SwapMessages {
    static offer(
        symbol: string,
        offer: { side: SwapSide; amountUsdc: number; expectedReceived: number },
    ): string {
        const s = escapeHtml(symbol);
        if (offer.side === SwapSide.UsdcToBase) {
            return (
                `${EMOJI.REFRESH} Swap ~${formatFiat(offer.amountUsdc)} USDC → ~${offer.expectedReceived.toFixed(6)} ${s}?\n\n` +
                `This converts part of your USDC balance to ${s} to fit the grid.\n\n` +
                `${EMOJI.WARNING} Price may move during execution; the order uses a marketable IOC with a slippage cap.`
            );
        }
        return (
            `${EMOJI.REFRESH} Swap ~${offer.amountUsdc.toFixed(6)} ${s} → ~${formatFiat(offer.expectedReceived)} USDC?\n\n` +
            `This converts part of your ${s} balance to USDC to fit the grid.\n\n` +
            `${EMOJI.WARNING} Price may move during execution; the order uses a marketable IOC with a slippage cap.`
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
}
