import { GridDto } from './dto/grid.dto';
import { OrderDto } from './dto/order.dto';
import { CreateGridDto } from './dto/create-grid.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridWithAccountDto } from './dto/grid-with-account.dto';

export { GridWithAccountDto };

export const GRIDS_API_PORT = Symbol('GRIDS_API_PORT');

export interface GridsApiPort {
    // ── Grids — write ──────────────────────────────────────────────
    /** Persist a new grid and return it. */
    createGrid(dto: CreateGridDto): Promise<GridDto>;
    /** Set status to Running for an idle/stopped grid. */
    updateGridStatus(id: string, status: GridStatus.Running): Promise<void>;
    /** Set status=Stopped and record the optional price snapshot at the moment of stop. */
    markStopped(id: string, stopPrice?: number): Promise<void>;
    /** Sets status=Stopped, stop_loss_triggered_at, and the stop price in a single save. */
    markStoppedByStopLoss(id: string, stopPrice?: number): Promise<void>;

    // ── Grids — read ───────────────────────────────────────────────
    /** Find a grid by its UUID. Returns null if not found. */
    findGridById(id: string): Promise<GridDto | null>;
    /** Return all grids in an active state. */
    findActiveGrids(): Promise<GridDto[]>;
    /** Return all active grids owned by the given user. */
    findActiveGridsByUserId(userId: string): Promise<GridDto[]>;
    /** Return a paginated list of grids, optionally filtered by status. */
    findGridsPaged(filter: {
        status?: GridStatus;
        page: number;
        pageSize: number;
    }): Promise<{ items: GridDto[]; totalCount: number; currentPage: number }>;

    // ── Orders — write ─────────────────────────────────────────────
    /** Persist a new order and return it. */
    createOrder(dto: CreateOrderDto): Promise<OrderDto>;
    /** Update the status of an order; optionally record the fill timestamp. */
    updateOrderStatus(orderId: string, status: OrderStatus, filledAt?: Date): Promise<void>;
    /** Record the USDC fee charged for an order. */
    updateOrderFee(orderId: string, feeUsdc: number): Promise<void>;
    /** Attach the exchange-assigned order ID and update status and placement time. */
    updateOrderExchangeId(
        orderId: string,
        exchangeOrderId: string,
        status: OrderStatus,
        placedAt: Date,
    ): Promise<void>;

    // ── Orders — read ──────────────────────────────────────────────
    /** Return all active (non-terminal) orders belonging to a grid. */
    findActiveOrdersByGridId(gridId: string): Promise<OrderDto[]>;
    /** Return all orders (any status) belonging to a grid. */
    findOrdersByGridId(gridId: string): Promise<OrderDto[]>;
    /** Find an order by its exchange-assigned ID. Returns null if not found. */
    findOrderByExchangeId(exchangeOrderId: string): Promise<OrderDto | null>;
    /** Return all orders with the given status. */
    findOrdersByStatus(status: OrderStatus): Promise<OrderDto[]>;
    /** Return all orders belonging to any of the given grid IDs. */
    findOrdersByGridIds(gridIds: string[]): Promise<OrderDto[]>;
    /** Return only placed (open on exchange) orders for the given grid IDs. */
    findPlacedOrdersByGridIds(gridIds: string[]): Promise<OrderDto[]>;

    // ── Cursor-based read ──────────────────────────────────────────
    /** Return up to `limit` active grids after the given cursor ID for batch processing. */
    findActiveGridsByCursor(afterId: string | null, limit: number): Promise<GridWithAccountDto[]>;
}
