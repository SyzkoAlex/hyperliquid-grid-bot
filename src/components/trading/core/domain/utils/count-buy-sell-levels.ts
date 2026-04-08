export interface BuySellLevelCounts {
    buyLevels: number;
    sellLevels: number;
}

/**
 * Counts how many grid price levels fall below (buy) and at-or-above (sell) the current price.
 *
 * The grid produces `levels + 1` price points spaced evenly between lowerPrice and upperPrice.
 * A level is a buy level when its price is strictly below currentPrice; otherwise it is a sell level.
 */
export function countBuySellLevels(
    levels: number,
    lowerPrice: number,
    upperPrice: number,
    currentPrice: number,
): BuySellLevelCounts {
    const priceStep = (upperPrice - lowerPrice) / levels;
    let buyLevels = 0;
    let sellLevels = 0;
    for (let i = 0; i <= levels; i++) {
        const levelPrice = lowerPrice + priceStep * i;
        if (levelPrice < currentPrice) {
            buyLevels++;
        } else {
            sellLevels++;
        }
    }
    return { buyLevels, sellLevels };
}
