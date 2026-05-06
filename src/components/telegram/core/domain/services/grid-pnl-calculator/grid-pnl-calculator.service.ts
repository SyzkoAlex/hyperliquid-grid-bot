import { Injectable } from '@nestjs/common';
import { OrderSide } from '@domain/models/order/order-side';
import { GridPnl } from '../../models/grid-pnl';

/**
 * Grid PnL Calculator
 *
 * gridProfit    — realized profit from completed buy→sell cycles (sell revenue minus cost basis of sold tokens)
 * unrealizedPnl — mark-to-market P&L of tokens still held (qtyHeld × (currentPrice − avgBuyPrice))
 *
 * Invariant: gridProfit + unrealizedPnl = sellVolume + qtyHeld × currentPrice − buyVolume
 * (where buyVolume and qtyHeld include the initialBase allocation when provided)
 *
 * @see docs/GRID-PNL-CALCULATION.md
 */
@Injectable()
export class GridPnlCalculatorService {
    calculate(
        filledOrders: { side: OrderSide; price: number; amount: number; feeUsdc?: number }[],
        currentPrice: number,
        initialBase?: { amount: number; price: number },
    ): GridPnl {
        // Seed buy side with the initial base token allocation so that initial sell
        // orders (placed at grid start from the initial USOL/BTC/etc.) get a correct
        // cost basis instead of defaulting to zero.
        let sellVolume = 0;
        let buyVolume = initialBase ? initialBase.amount * initialBase.price : 0;
        let totalBuyQty = initialBase?.amount ?? 0;
        let totalSellQty = 0;
        let totalFees = 0;

        for (const order of filledOrders) {
            const value = order.price * order.amount;

            if (order.side === OrderSide.Sell) {
                sellVolume += value;
                totalSellQty += order.amount;
            } else {
                buyVolume += value;
                totalBuyQty += order.amount;
            }

            if (order.feeUsdc) {
                totalFees += order.feeUsdc;
            }
        }

        const avgBuyPrice = totalBuyQty > 0 ? buyVolume / totalBuyQty : 0;
        const qtyHeld = totalBuyQty - totalSellQty;
        const gridProfit = sellVolume - totalSellQty * avgBuyPrice;
        const unrealizedPnl = qtyHeld * (currentPrice - avgBuyPrice);

        return { gridProfit, unrealizedPnl, totalFees };
    }
}
