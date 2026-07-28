import { HYPERLIQUID_SPOT_FEE } from './constants/hyperliquid-fees';

export interface GridFeeMetrics {
    feePerCycle: number;
    profitPerGridPct: number;
    gridStepPct: number;
    isProfitable: boolean;
}

export function calculateGridFeeMetrics(params: {
    lowerPrice: number;
    upperPrice: number;
    orderCount: number;
    totalInvestment: number;
}): GridFeeMetrics {
    const { lowerPrice, upperPrice, orderCount, totalInvestment } = params;
    const midPrice = (upperPrice + lowerPrice) / 2;
    const orderSize = totalInvestment / orderCount;
    const feePerCycle = orderSize * HYPERLIQUID_SPOT_FEE.makerRate * orderCount * 2;
    const gridStepPct = ((upperPrice - lowerPrice) / (orderCount - 1) / midPrice) * 100;
    const profitPerGridPct = gridStepPct - 2 * HYPERLIQUID_SPOT_FEE.makerRate * 100;
    return { feePerCycle, profitPerGridPct, gridStepPct, isProfitable: profitPerGridPct > 0 };
}
