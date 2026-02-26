import { Injectable } from '@nestjs/common';
import { OrderSide } from '@domain/models/order/order-side';
import { GridPnl } from '../../models/grid-pnl';

/**
 * Grid PnL Calculator Service
 *
 * @see docs/GRID-PNL-RESEARCH.md — research on correct PnL calculation
 * (Total PnL, Unrealized PnL, Grid Profit, vs HODL, fee breakeven)
 *
 * TODO: GridPnlCalculatorService — fees (not stored per-order yet)
 */
@Injectable()
export class GridPnlCalculatorService {
    /**
     * gridProfit   = Σ(filled_sell × price) − Σ(filled_buy × price), gross (no fees)
     * unrealizedPnl = qtyHeld × (currentPrice − avgBuyPrice)
     *
     * Expects only filled orders with non-null prices (caller filters).
     *
     * @see docs/GRID-PNL-RESEARCH.md
     */
    calculate(
        filledOrders: { side: OrderSide; price: number; amount: number }[],
        currentPrice: number,
    ): GridPnl {
        let sellVolume = 0;
        let buyVolume = 0;
        let totalBuyQty = 0;
        let totalSellQty = 0;
        let weightedBuyPriceSum = 0;

        for (const order of filledOrders) {
            const value = order.price * order.amount;

            if (order.side === OrderSide.Sell) {
                sellVolume += value;
                totalSellQty += order.amount;
            } else {
                buyVolume += value;
                totalBuyQty += order.amount;
                weightedBuyPriceSum += value;
            }
        }

        const gridProfit = sellVolume - buyVolume;
        const qtyHeld = totalBuyQty - totalSellQty;
        const avgBuyPrice = totalBuyQty > 0 ? weightedBuyPriceSum / totalBuyQty : 0;
        const unrealizedPnl = qtyHeld * (currentPrice - avgBuyPrice);

        return { gridProfit, unrealizedPnl };
    }
}
