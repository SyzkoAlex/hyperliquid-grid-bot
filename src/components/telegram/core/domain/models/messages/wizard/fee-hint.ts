import { HYPERLIQUID_SPOT_FEE } from '../../constants/hyperliquid-fees';
import { EMOJI } from '../../constants/emoji';

interface FeeHintParams {
    suggestedMax: number;
    levels: number;
    lowerPrice: number;
    upperPrice: number;
}

export function feeHintLine(params?: FeeHintParams): string {
    if (!params) {
        return (
            `${EMOJI.MONEY_WINGS} Trading fee: ~${(HYPERLIQUID_SPOT_FEE.takerRate * 100).toFixed(2)}% taker` +
            ` / ~${(HYPERLIQUID_SPOT_FEE.makerRate * 100).toFixed(2)}% maker`
        );
    }
    const { suggestedMax, levels, lowerPrice, upperPrice } = params;
    const orderSize = suggestedMax / levels;
    const midPrice = (lowerPrice + upperPrice) / 2;
    const gridStepFraction = (upperPrice - lowerPrice) / levels / midPrice;
    const profitPerFill = orderSize * gridStepFraction;
    const feePerFill = orderSize * HYPERLIQUID_SPOT_FEE.makerRate;
    return (
        `${EMOJI.MONEY_WINGS} ~$${Math.round(orderSize)}/order` +
        ` → profit ~$${profitPerFill.toFixed(2)}/sell` +
        `, fee ~$${feePerFill.toFixed(2)}`
    );
}
