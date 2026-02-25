import { Injectable } from '@nestjs/common';
import { OrderDto } from '@/components/grids/api/dto/order.dto';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
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
     * @see docs/GRID-PNL-RESEARCH.md
     */
    calculate(orders: OrderDto[], currentPrice: number): GridPnl {
        const filled = orders.filter((o) => o.status === OrderStatus.Filled && o.price !== null);

        let sellVolume = 0;
        let buyVolume = 0;
        let totalBuyQty = 0;
        let totalSellQty = 0;
        let weightedBuyPriceSum = 0;

        for (const order of filled) {
            const price = order.price!;
            const amount = order.amount;
            const value = price * amount;

            if (order.side === OrderSide.Sell) {
                sellVolume += value;
                totalSellQty += amount;
            } else {
                buyVolume += value;
                totalBuyQty += amount;
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
