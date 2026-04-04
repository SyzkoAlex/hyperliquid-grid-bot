import { Order } from '../../domain/models/order/order';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridId } from '../../domain/models/grid/grid-id';

export const ORDER_REPOSITORY_PORT = Symbol('ORDER_REPOSITORY_PORT');

export interface OrderRepositoryPort {
    save(order: Order): Promise<void>;
    findManyActive(gridId: GridId): Promise<Order[]>;
    findManyByGridId(gridId: GridId): Promise<Order[]>;
    findOneByExchangeOrderId(exchangeOrderId: string): Promise<Order | null>;
    findManyByStatus(status: OrderStatus): Promise<Order[]>;
    findManyByGridIds(gridIds: string[]): Promise<Order[]>;
    findManyPlacedByGridIds(gridIds: string[]): Promise<Order[]>;
    updateStatus(orderId: string, status: OrderStatus, filledAt?: Date): Promise<void>;
    updateFee(orderId: string, feeUsdc: string): Promise<void>;
    updateExchangeOrderId(
        orderId: string,
        exchangeOrderId: string,
        status: OrderStatus,
        placedAt: Date,
    ): Promise<void>;
}
