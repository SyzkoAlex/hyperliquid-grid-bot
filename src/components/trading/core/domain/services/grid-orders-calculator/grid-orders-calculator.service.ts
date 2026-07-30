import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { OrderSide } from '@domain/models/order/order-side';
import { GridOrder } from './grid-order';

/**
 * Grid Orders Calculator Service
 *
 * Calculates grid orders and order sizes for SPOT grid trading.
 *
 * ## How we calculate:
 *
 * ### 1. Grid Orders Distribution
 * Grid is divided into `orderCount` orders placed inclusively between lower and upper bounds:
 * ```
 * priceStep = (upperPrice - lowerPrice) / (orderCount - 1)
 * orderPrice[i] = lowerPrice + (priceStep * i),  i = 0 .. orderCount - 1
 * ```
 *
 * ### 2. Order Side Determination
 * Each order is assigned buy or sell based on current market price:
 * ```
 * if (orderPrice < currentPrice):
 *     side = Buy   (place buy orders below current price)
 * else:
 *     side = Sell  (place sell orders above current price)
 * ```
 *
 * ### 3. Capital Distribution
 * Capital is distributed EQUALLY across all orders of same side:
 *
 * **Buy Orders (below current price):**
 * ```
 * quotePerOrder = totalInvestmentQuote / buyOrdersCount
 * amountUSDC = quotePerOrder           (USDC to spend)
 * amountBase = quotePerOrder / price    (tokens to receive)
 * ```
 *
 * **Sell Orders (above current price):**
 * Base tokens are distributed equally. This gives equal notional at CURRENT price
 * (which is what the exchange uses to validate minimum order value):
 * ```
 * basePerOrder = totalInvestmentBase / sellOrdersCount
 * amountBase = basePerOrder                (tokens to sell, same for all sell orders)
 * amountUSDC = basePerOrder * price        (USDC to receive, varies by order price)
 * ```
 */
export class GridOrdersCalculatorService {
    constructor(
        private readonly minOrderNotional: number,
        private readonly sellSizeBuffer: number,
    ) {}

    calculateOrdersWithSizes(
        lowerPrice: number,
        upperPrice: number,
        orderCount: number,
        investmentUSDC: number,
        investmentBase: number,
        currentPrice: Price,
    ): GridOrder[] {
        const totalInvestmentUSDC = investmentUSDC + investmentBase * currentPrice.toNumber();
        const gridOrders = this.calculateOrders(lowerPrice, upperPrice, orderCount, currentPrice);
        const ordersWithSizes = this.calculateOrderSizes(
            investmentUSDC,
            investmentBase,
            gridOrders,
        );
        this.validateMinOrderNotional(ordersWithSizes, totalInvestmentUSDC, currentPrice);
        return ordersWithSizes;
    }

    private validateMinOrderNotional(
        orders: GridOrder[],
        totalInvestmentUSDC: number,
        currentPrice: Price,
    ): void {
        // Exchange validates order notional at current market price, not limit price.
        // For buy orders: amountBase * currentPrice > amountUSDC (current > limitPrice) — passes easier.
        // For sell orders: amountBase * currentPrice < amountUSDC (current < limitPrice) — stricter check.
        const minNotionalAtCurrentPrice = orders
            .filter((o) => o.amountBase !== undefined)
            .reduce((min, o) => Math.min(min, o.amountBase! * currentPrice.toNumber()), Infinity);

        if (minNotionalAtCurrentPrice < this.minOrderNotional) {
            const minRequiredUSDC = Math.ceil(
                totalInvestmentUSDC * (this.minOrderNotional / minNotionalAtCurrentPrice),
            );
            throw new Error(
                `Order notional value $${minNotionalAtCurrentPrice.toFixed(2)} per order is below minimum $${this.minOrderNotional.toFixed(2)}. Minimum investment for current configuration: $${minRequiredUSDC}. Increase investment or reduce number of orders.`,
            );
        }
    }

    private getOrderPrice(
        lowerPrice: number,
        upperPrice: number,
        orderCount: number,
        orderIndex: number,
    ): Price {
        const priceStep = (upperPrice - lowerPrice) / (orderCount - 1);
        return Price.from(lowerPrice + priceStep * orderIndex);
    }

    private calculateOrders(
        lowerPrice: number,
        upperPrice: number,
        orderCount: number,
        currentPrice: Price,
    ): GridOrder[] {
        const result: GridOrder[] = [];

        for (let i = 0; i < orderCount; i++) {
            const orderPrice = this.getOrderPrice(lowerPrice, upperPrice, orderCount, i);
            const isBelowCurrentPrice = orderPrice.lt(currentPrice);

            result.push({
                index: i,
                price: orderPrice,
                side: isBelowCurrentPrice ? OrderSide.Buy : OrderSide.Sell,
            });
        }

        return result;
    }

    private calculateOrderSizes(
        investmentUSDC: number,
        investmentBase: number,
        orders: GridOrder[],
    ): GridOrder[] {
        const buyOrders = orders.filter((o) => o.side === OrderSide.Buy);
        const sellOrders = orders.filter((o) => o.side === OrderSide.Sell);

        const quotePerBuyOrder = Decimal.from(investmentUSDC).div(Decimal.from(buyOrders.length));
        // Buffer ensures sell order notional stays above exchange minimum
        // despite ceil-rounding in the exchange adapter and small price fluctuations during placement
        const basePerSellOrder = Decimal.from(investmentBase)
            .div(Decimal.from(sellOrders.length))
            .mul(Decimal.from(1 + this.sellSizeBuffer));

        return orders.map((order) => {
            if (order.side === OrderSide.Buy) {
                return {
                    ...order,
                    amountUSDC: quotePerBuyOrder.toNumber(),
                    amountBase: quotePerBuyOrder
                        .div(Decimal.from(order.price.toNumber()))
                        .toNumber(),
                };
            } else {
                return {
                    ...order,
                    amountBase: basePerSellOrder.toNumber(),
                    amountUSDC: basePerSellOrder
                        .mul(Decimal.from(order.price.toNumber()))
                        .toNumber(),
                };
            }
        });
    }
}
