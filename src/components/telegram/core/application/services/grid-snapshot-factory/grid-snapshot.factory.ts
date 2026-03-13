import { Injectable } from '@nestjs/common';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridSnapshot } from '../../../domain/models/grid-snapshot';
import { GridPnlCalculatorService } from '../../../domain/services/grid-pnl-calculator/grid-pnl-calculator.service';
import { computeOrderStats } from '../../../domain/models/order-stats';

@Injectable()
export class GridSnapshotFactory {
    constructor(private readonly pnlCalculator: GridPnlCalculatorService) {}

    create(grid: GridDto, orders: OrderDto[], currentPrice: number): GridSnapshot {
        const activeOrders = this.getActiveOrders(orders);
        const filledOrders = this.getFilledOrders(orders);

        const pnl = this.pnlCalculator.calculate(
            filledOrders.map((o) => ({ side: o.side, price: o.price!, amount: o.amount })),
            currentPrice,
        );
        const orderStats = computeOrderStats(activeOrders, filledOrders);
        return { grid, pnl, currentPrice, orderStats, activeOrders, filledOrders };
    }

    private getFilledOrders(orders: OrderDto[]): OrderDto[] {
        return orders
            .filter((o) => o.status === OrderStatus.Filled && o.price !== null)
            .sort((a, b) => (b.filledAt ?? 0) - (a.filledAt ?? 0));
    }

    private getActiveOrders(orders: OrderDto[]): OrderDto[] {
        return orders.filter(
            (o) => o.status === OrderStatus.Pending || o.status === OrderStatus.Placed,
        );
    }
}
