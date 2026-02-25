import { OrderDto } from '@/components/grids/api/dto/order.dto';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';

export interface GridPnl {
    gridProfit: number;
    unrealizedPnl: number;
}

export interface OrderStats {
    activeBuys: number;
    activeSells: number;
    avgActiveBuyPrice: number;
    avgActiveSellPrice: number;
    lowestActiveBuyPrice: number;
    highestActiveSellPrice: number;
    filledCycles: number;
}

function isActive(o: OrderDto): boolean {
    return o.status === OrderStatus.Pending || o.status === OrderStatus.Placed;
}

function weightedAvgPrice(orders: OrderDto[]): number {
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

export function computeOrderStats(orders: OrderDto[]): OrderStats {
    const activeBuyOrders = orders.filter((o) => isActive(o) && o.side === OrderSide.Buy);
    const activeSellOrders = orders.filter((o) => isActive(o) && o.side === OrderSide.Sell);

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
        filledCycles: orders.filter(
            (o) => o.status === OrderStatus.Filled && o.side === OrderSide.Sell,
        ).length,
    };
}
