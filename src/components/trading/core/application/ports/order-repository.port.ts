import { Order } from '@domain/models/order/order';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridId } from '@domain/models/grid/grid-id';

export const ORDER_REPOSITORY_PORT = Symbol('ORDER_REPOSITORY_PORT');

export interface OrderRepositoryPort {
    save(order: Order): Promise<void>;
    findManyActive(gridId: GridId): Promise<Order[]>;
    findOneByExchangeOrderId(exchangeOrderId: string): Promise<Order | null>;
    updateStatus(orderId: string, status: OrderStatus, filledAt?: Date): Promise<void>;
    findManyPendingByGridId(gridId: string): Promise<Order[]>;
    updateExchangeOrderId(
        orderId: string,
        exchangeOrderId: string,
        status: OrderStatus,
        placedAt: Date,
    ): Promise<void>;
    findManyStalePending(olderThan: Date): Promise<Order[]>;
    findManyByStatus(status: OrderStatus): Promise<Order[]>;
    findManyByIds(orderIds: string[]): Promise<Order[]>;
    findManyPlacedByGridIds(gridIds: string[]): Promise<Order[]>;
}
