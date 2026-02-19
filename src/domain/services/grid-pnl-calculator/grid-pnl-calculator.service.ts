import { Injectable } from '@nestjs/common';
import { Order } from '@domain/models/order/order';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';

/**
 * Grid PnL Calculator Service
 *
 * Calculates realized PnL for a grid from its filled orders.
 *
 * Formula:
 *   PnL = Σ(sell_price × amount) − Σ(buy_price × amount)
 *
 * Uses order amount (not filledAmount) since partial fills are not tracked —
 * an order is either fully filled or not filled at all.
 */
@Injectable()
export class GridPnlCalculatorService {
    calculate(orders: Order[]): number {
        const filled = orders.filter((o) => o.status === OrderStatus.Filled && o.price !== null);

        let sellVolume = 0;
        let buyVolume = 0;

        for (const order of filled) {
            const value = order.price!.toNumber() * order.amount.toNumber();
            if (order.side === OrderSide.Sell) {
                sellVolume += value;
            } else {
                buyVolume += value;
            }
        }

        return sellVolume - buyVolume;
    }
}
