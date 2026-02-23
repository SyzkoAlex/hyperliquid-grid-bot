import { Grid } from '@domain/models/grid/grid';
import { GridId } from '@domain/models/grid/grid-id';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Order } from '@domain/models/order/order';
import { OrderStatus } from '@domain/models/order/order-status';

export const GRIDS_PORT = Symbol('GRIDS_PORT');

export interface GridsPort {
    // ── Grids ──────────────────────────────────────────────────────
    saveGrid(grid: Grid): Promise<void>;
    findGridById(id: GridId): Promise<Grid | null>;
    findActiveGrids(): Promise<Grid[]>;
    findActiveGridsByIds(gridIds: string[]): Promise<Grid[]>;
    findGridsByStatus(status: GridStatus): Promise<Grid[]>;
    findAllGrids(): Promise<Grid[]>;

    // ── Orders ─────────────────────────────────────────────────────
    saveOrder(order: Order): Promise<void>;
    findActiveOrdersByGridId(gridId: GridId): Promise<Order[]>;
    findOrdersByGridId(gridId: GridId): Promise<Order[]>;
    findOrderByExchangeId(exchangeOrderId: string): Promise<Order | null>;
    findPendingOrdersByGridId(gridId: string): Promise<Order[]>;
    findStalePendingOrders(olderThan: Date): Promise<Order[]>;
    findOrdersByStatus(status: OrderStatus): Promise<Order[]>;
    findOrdersByIds(orderIds: string[]): Promise<Order[]>;
    findPlacedOrdersByGridIds(gridIds: string[]): Promise<Order[]>;
    updateOrderStatus(orderId: string, status: OrderStatus, filledAt?: Date): Promise<void>;
    updateOrderExchangeId(
        orderId: string,
        exchangeOrderId: string,
        status: OrderStatus,
        placedAt: Date,
    ): Promise<void>;
}
