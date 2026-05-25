import { HYPERLIQUID_SPOT_FEE } from '../../constants/hyperliquid-fees';
import { EMOJI } from '../../constants/emoji';
import { calculateGridFeeMetrics } from '../../grid-fee-calculator';

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
    const metrics = calculateGridFeeMetrics({
        lowerPrice,
        upperPrice,
        levels,
        totalInvestment: suggestedMax,
    });
    const orderSize = suggestedMax / levels;
    // profitPerCycle: gross profit per order per completed grid step (buy + sell round-trip)
    const profitPerCycle = (orderSize * metrics.gridStepPct) / 100;
    // feePerCycle: maker fee for both fills (buy fill + sell fill) for one order
    const feePerCycle = metrics.feePerCycle / levels;
    return (
        `${EMOJI.MONEY_WINGS} ~$${Math.round(orderSize)}/order` +
        ` → profit ~$${profitPerCycle.toFixed(2)}/cycle` +
        `, fee ~$${feePerCycle.toFixed(2)}`
    );
}
