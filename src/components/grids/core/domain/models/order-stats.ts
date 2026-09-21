import { OrderSide } from '@domain/models/order/order-side';

export interface OrderStats {
    activeBuys: number;
    activeSells: number;
    avgActiveBuyPrice: number;
    avgActiveSellPrice: number;
    lowestActiveBuyPrice: number;
    highestActiveSellPrice: number;
    filledCycles: number;
}

type OrderData = { side: OrderSide; price: number | null; amount: number };

function weightedAvgPrice(orders: OrderData[]): number {
    if (orders.length === 0) return 0;
    let sumPriceQty = 0;
    let sumQty = 0;
    for (const o of orders) {
        const price = o.price ?? 0;
        const qty = o.amount;
        sumPriceQty += price * qty;
        sumQty += qty;
    }
    return sumQty > 0 ? sumPriceQty / sumQty : 0;
}

export function computeOrderStats(
    activeOrders: OrderData[],
    filledOrders: OrderData[],
): OrderStats {
    const activeBuyOrders = activeOrders.filter((o) => o.side === OrderSide.Buy);
    const activeSellOrders = activeOrders.filter((o) => o.side === OrderSide.Sell);

    const avgActiveBuyPrice = weightedAvgPrice(activeBuyOrders);
    const avgActiveSellPrice = weightedAvgPrice(activeSellOrders);

    const buyPrices = activeBuyOrders.map((o) => o.price ?? 0).filter((p) => p > 0);
    const sellPrices = activeSellOrders.map((o) => o.price ?? 0).filter((p) => p > 0);

    return {
        activeBuys: activeBuyOrders.length,
        activeSells: activeSellOrders.length,
        avgActiveBuyPrice,
        avgActiveSellPrice,
        lowestActiveBuyPrice: buyPrices.length > 0 ? Math.min(...buyPrices) : 0,
        highestActiveSellPrice: sellPrices.length > 0 ? Math.max(...sellPrices) : 0,
        filledCycles: filledOrders.filter((o) => o.side === OrderSide.Sell).length,
    };
}
