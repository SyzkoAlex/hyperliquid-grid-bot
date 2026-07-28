export interface BuySellOrderCounts {
    buyOrders: number;
    sellOrders: number;
}

/**
 * Counts how many grid orders fall below (buy) and at-or-above (sell) the current price.
 *
 * The grid places `orderCount` orders spaced evenly between lowerPrice and upperPrice, inclusive
 * of both bounds. An order is a buy order when its price is strictly below currentPrice;
 * otherwise it is a sell order.
 */
export function countBuySellOrders(
    orderCount: number,
    lowerPrice: number,
    upperPrice: number,
    currentPrice: number,
): BuySellOrderCounts {
    const priceStep = (upperPrice - lowerPrice) / (orderCount - 1);
    let buyOrders = 0;
    let sellOrders = 0;
    for (let i = 0; i < orderCount; i++) {
        const orderPrice = lowerPrice + priceStep * i;
        if (orderPrice < currentPrice) {
            buyOrders++;
        } else {
            sellOrders++;
        }
    }
    return { buyOrders, sellOrders };
}
