import { Inject, Injectable } from '@nestjs/common';
import { Order } from '@domain/models/order/order';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridPnlCalculatorService } from '@domain/services/grid-pnl-calculator/grid-pnl-calculator.service';
import {
    TRADING_QUERY_PORT,
    TradingQueryPort,
} from '@components/trading/core/application/ports/trading-query.port';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { GRIDS_PORT, GridsPort } from '@components/grids/core/application/ports/grids.port';
import { GridFilter } from './grid-filter';
import { GridWithPnl, OrderStats } from './grid-with-pnl';

@Injectable()
export class GetGridsWithPnlUseCase {
    constructor(
        @Inject(GRIDS_PORT) private readonly grids: GridsPort,
        @Inject(TRADING_QUERY_PORT) private readonly tradingQuery: TradingQueryPort,
        private readonly pnlCalculator: GridPnlCalculatorService,
    ) {}

    async execute(filter: GridFilter = GridFilter.All): Promise<GridWithPnl[]> {
        const gridList = await this.fetchGrids(filter);

        return Promise.all(
            gridList.map(async (grid) => {
                const [orders, currentPrice] = await Promise.all([
                    this.grids.findOrdersByGridId(grid.id),
                    this.tradingQuery.getCurrentPrice(grid.symbol),
                ]);
                const price = currentPrice.toNumber();
                const pnl = this.pnlCalculator.calculate(orders, price);
                const orderStats = computeOrderStats(orders);
                return { grid, pnl, currentPrice: price, orderStats, orders };
            }),
        );
    }

    private async fetchGrids(filter: GridFilter) {
        if (filter === GridFilter.Running) {
            return this.grids.findGridsByStatus(GridStatus.Running);
        }
        if (filter === GridFilter.Stopped) {
            return this.grids.findGridsByStatus(GridStatus.Stopped);
        }
        return this.grids.findAllGrids();
    }
}

function isActive(o: Order): boolean {
    return o.status === OrderStatus.Pending || o.status === OrderStatus.Placed;
}

export function computeOrderStats(orders: Order[]): OrderStats {
    const activeBuyOrders = orders.filter((o) => isActive(o) && o.side === OrderSide.Buy);
    const activeSellOrders = orders.filter((o) => isActive(o) && o.side === OrderSide.Sell);

    const avgActiveBuyPrice = weightedAvgPrice(activeBuyOrders);
    const avgActiveSellPrice = weightedAvgPrice(activeSellOrders);

    const buyPrices = activeBuyOrders.map((o) => o.price?.toNumber() ?? 0).filter((p) => p > 0);
    const sellPrices = activeSellOrders.map((o) => o.price?.toNumber() ?? 0).filter((p) => p > 0);

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

function weightedAvgPrice(orders: Order[]): number {
    if (orders.length === 0) return 0;
    let sumPriceQty = 0;
    let sumQty = 0;
    for (const o of orders) {
        const price = o.price?.toNumber() ?? 0;
        const qty = o.amount.toNumber();
        sumPriceQty += price * qty;
        sumQty += qty;
    }
    return sumQty > 0 ? sumPriceQty / sumQty : 0;
}
