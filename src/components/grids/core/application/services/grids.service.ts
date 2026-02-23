import { Injectable } from '@nestjs/common';
import { Grid } from '@domain/models/grid/grid';
import { GridId } from '@domain/models/grid/grid-id';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Order } from '@domain/models/order/order';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridsPort } from '../ports/grids.port';
import { PostgresGridRepositoryAdapter } from '@components/grids/adapters/outbound/persistence/grid/postgres-grid-repository.adapter';
import { PostgresOrderRepositoryAdapter } from '@components/grids/adapters/outbound/persistence/order/postgres-order-repository.adapter';

@Injectable()
export class GridsService implements GridsPort {
    constructor(
        private readonly gridRepo: PostgresGridRepositoryAdapter,
        private readonly orderRepo: PostgresOrderRepositoryAdapter,
    ) {}

    saveGrid(grid: Grid): Promise<void> {
        return this.gridRepo.save(grid);
    }

    findGridById(id: GridId): Promise<Grid | null> {
        return this.gridRepo.findOneById(id);
    }

    findActiveGrids(): Promise<Grid[]> {
        return this.gridRepo.findManyActive();
    }

    findActiveGridsByIds(gridIds: string[]): Promise<Grid[]> {
        return this.gridRepo.findManyActiveByIds(gridIds);
    }

    findGridsByStatus(status: GridStatus): Promise<Grid[]> {
        return this.gridRepo.findManyByStatus(status);
    }

    findAllGrids(): Promise<Grid[]> {
        return this.gridRepo.findAll();
    }

    saveOrder(order: Order): Promise<void> {
        return this.orderRepo.save(order);
    }

    findActiveOrdersByGridId(gridId: GridId): Promise<Order[]> {
        return this.orderRepo.findManyActive(gridId);
    }

    findOrdersByGridId(gridId: GridId): Promise<Order[]> {
        return this.orderRepo.findManyByGridId(gridId);
    }

    findOrderByExchangeId(exchangeOrderId: string): Promise<Order | null> {
        return this.orderRepo.findOneByExchangeOrderId(exchangeOrderId);
    }

    findPendingOrdersByGridId(gridId: string): Promise<Order[]> {
        return this.orderRepo.findManyPendingByGridId(gridId);
    }

    findStalePendingOrders(olderThan: Date): Promise<Order[]> {
        return this.orderRepo.findManyStalePending(olderThan);
    }

    findOrdersByStatus(status: OrderStatus): Promise<Order[]> {
        return this.orderRepo.findManyByStatus(status);
    }

    findOrdersByIds(orderIds: string[]): Promise<Order[]> {
        return this.orderRepo.findManyByIds(orderIds);
    }

    findPlacedOrdersByGridIds(gridIds: string[]): Promise<Order[]> {
        return this.orderRepo.findManyPlacedByGridIds(gridIds);
    }

    updateOrderStatus(orderId: string, status: OrderStatus, filledAt?: Date): Promise<void> {
        return this.orderRepo.updateStatus(orderId, status, filledAt);
    }

    updateOrderExchangeId(
        orderId: string,
        exchangeOrderId: string,
        status: OrderStatus,
        placedAt: Date,
    ): Promise<void> {
        return this.orderRepo.updateExchangeOrderId(orderId, exchangeOrderId, status, placedAt);
    }
}
