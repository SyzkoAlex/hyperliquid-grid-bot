import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, lt } from 'drizzle-orm';
import type { DrizzleDb } from '../../../../../infra/database/drizzle-db';
import { DRIZZLE_DB } from '../../../../../infra/database/database.module';
import { Order } from '../../../core/domain/order/order';
import { OrderStatus } from '../../../core/domain/order/order-status';
import { OrderDbRecord, orders } from '../../../../../infra/database/schema';
import { logger } from '../../../../../infra/logger/logger';
import { GridId } from '@components/trading/core/domain/grid/grid-id';
import { PostgresOrderMapper } from './postgres-order.mapper';

/**
 * Postgres Order Repository
 * Secondary Adapter for Order persistence
 *
 * Follows DDD principles - works only with Order domain entity.
 * All orders (including grid orders) are stored in the unified 'orders' table.
 */
@Injectable()
export class PostgresOrderRepository {
    private readonly logger = logger.child({ context: PostgresOrderRepository.name });

    constructor(
        @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
        private readonly mapper: PostgresOrderMapper,
    ) {}

    /**
     * Save a new order
     */
    async save(order: Order): Promise<void> {
        try {
            await this.db.insert(orders).values(this.mapper.toDbRecord(order));
            this.logger.debug({ orderId: order.id.toString() }, 'Order saved');
        } catch (error) {
            this.logger.error({ error, orderId: order.id.toString() }, 'Failed to save order');
            throw error;
        }
    }

    /**
     * Find active grid orders by grid ID
     */
    async findManyActive(gridId: GridId): Promise<Order[]> {
        try {
            const rows = await this.db
                .select()
                .from(orders)
                .where(
                    and(
                        eq(orders.gridId, gridId.toString()),
                        inArray(orders.status, [OrderStatus.Pending, OrderStatus.Placed]),
                    ),
                );

            return rows.map((row) => this.mapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error, gridId }, 'Failed to find active grid orders');
            throw error;
        }
    }

    /**
     * Find grid order by exchange order ID
     */
    async findOneByExchangeOrderId(exchangeOrderId: string): Promise<Order | null> {
        try {
            const rows = await this.db
                .select()
                .from(orders)
                .where(eq(orders.exchangeOrderId, exchangeOrderId))
                .limit(1);

            if (rows.length === 0) {
                return null;
            }

            const row = rows[0];

            return this.mapper.toDomain(row);
        } catch (error) {
            this.logger.error(
                { error, exchangeOrderId },
                'Failed to find grid order by exchange order ID',
            );
            throw error;
        }
    }

    /**
     * Update grid order status
     */
    async updateStatus(orderId: string, status: OrderStatus, filledAt?: Date): Promise<void> {
        try {
            const updateData: Partial<OrderDbRecord> = {
                status,
                updatedAt: new Date(),
            };

            if (status === OrderStatus.Filled && filledAt) {
                updateData.filledAt = filledAt;
            }

            if (status === OrderStatus.Cancelled) {
                updateData.cancelledAt = new Date();
            }

            await this.db.update(orders).set(updateData).where(eq(orders.id, orderId));

            this.logger.debug({ orderId, status }, 'Grid order status updated');
        } catch (error) {
            this.logger.error({ error, orderId, status }, 'Failed to update grid order status');
            throw error;
        }
    }

    /**
     * Find all pending orders for a specific grid
     * Used for CLOID fallback matching with price
     */
    async findManyPendingByGridId(gridId: string): Promise<Order[]> {
        try {
            const rows = await this.db
                .select()
                .from(orders)
                .where(and(eq(orders.gridId, gridId), eq(orders.status, OrderStatus.Pending)));

            return rows.map((row) => this.mapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error, gridId }, 'Failed to find pending orders by grid ID');
            throw error;
        }
    }

    /**
     * Update order with exchangeOrderId after placement
     * Called when order is placed or when WebSocket event arrives
     */
    async updateExchangeOrderId(
        orderId: string,
        exchangeOrderId: string,
        status: OrderStatus,
        placedAt: Date,
    ): Promise<void> {
        try {
            await this.db
                .update(orders)
                .set({
                    exchangeOrderId,
                    status,
                    placedAt,
                    updatedAt: new Date(),
                })
                .where(eq(orders.id, orderId));

            this.logger.debug({ orderId, exchangeOrderId, status }, 'Exchange order ID updated');
        } catch (error) {
            this.logger.error(
                { error, orderId, exchangeOrderId },
                'Failed to update exchange order ID',
            );
            throw error;
        }
    }

    /**
     * Find stale pending orders (older than given date)
     * Used for cleanup of stuck pending orders
     */
    async findManyStalePending(olderThan: Date): Promise<Order[]> {
        try {
            const rows = await this.db
                .select()
                .from(orders)
                .where(
                    and(eq(orders.status, OrderStatus.Pending), lt(orders.createdAt, olderThan)),
                );

            return rows.map((row) => this.mapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error, olderThan }, 'Failed to find stale pending orders');
            throw error;
        }
    }

    /**
     * Find orders by status
     * Used for order restoration to find pending orders that may exist on exchange
     */
    async findManyByStatus(status: OrderStatus): Promise<Order[]> {
        try {
            const rows = await this.db.select().from(orders).where(eq(orders.status, status));

            return rows.map((row) => this.mapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error, status }, 'Failed to find orders by status');
            throw error;
        }
    }
}
