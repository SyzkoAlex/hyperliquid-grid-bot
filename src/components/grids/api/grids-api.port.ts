import { GridDto } from './dto/grid.dto';
import { OrderDto } from './dto/order.dto';
import { CreateGridDto } from './dto/create-grid.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderStatus } from '@domain/models/order/order-status';

export const GRIDS_API_PORT = Symbol('GRIDS_API_PORT');

export interface GridsApiPort {
    // ── Grids — write ──────────────────────────────────────────────
    createGrid(dto: CreateGridDto): Promise<GridDto>;
    updateGridStatus(id: string, status: GridStatus, timestamp?: number): Promise<void>;

    // ── Grids — read ───────────────────────────────────────────────
    findGridById(id: string): Promise<GridDto | null>;
    findActiveGrids(): Promise<GridDto[]>;
    findGridsPaged(filter: {
        status?: GridStatus;
        page: number;
        pageSize: number;
    }): Promise<{ items: GridDto[]; totalCount: number; currentPage: number }>;

    // ── Orders — write ─────────────────────────────────────────────
    createOrder(dto: CreateOrderDto): Promise<OrderDto>;
    updateOrderStatus(orderId: string, status: OrderStatus, filledAt?: Date): Promise<void>;
    updateOrderFee(orderId: string, feeUsdc: number): Promise<void>;
    updateOrderExchangeId(
        orderId: string,
        exchangeOrderId: string,
        status: OrderStatus,
        placedAt: Date,
    ): Promise<void>;

    // ── Orders — read ──────────────────────────────────────────────
    findActiveOrdersByGridId(gridId: string): Promise<OrderDto[]>;
    findOrdersByGridId(gridId: string): Promise<OrderDto[]>;
    findOrderByExchangeId(exchangeOrderId: string): Promise<OrderDto | null>;
    findOrdersByStatus(status: OrderStatus): Promise<OrderDto[]>;
    findOrdersByGridIds(gridIds: string[]): Promise<OrderDto[]>;
    findPlacedOrdersByGridIds(gridIds: string[]): Promise<OrderDto[]>;
}
