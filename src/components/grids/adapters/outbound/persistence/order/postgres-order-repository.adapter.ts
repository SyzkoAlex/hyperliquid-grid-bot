import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleDb } from '@/infra/database/drizzle-db';
import { DRIZZLE_DB } from '@/infra/database/database.module';
import { Order } from '../../../../core/domain/models/order/order';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderDbRecord, orders } from '@/infra/database/schema';
import { logger } from '@/infra/logger/logger';
import { GridId } from '../../../../core/domain/models/grid/grid-id';
import { OrderRepositoryPort } from '../../../../core/application/ports/order-repository.port';
import { PostgresOrderMapper } from './postgres-order.mapper';
import { DuplicateActiveOrderError } from '../../../../core/domain/errors/duplicate-active-order.error';

@Injectable()
export class PostgresOrderRepositoryAdapter implements OrderRepositoryPort {
    private readonly logger = logger.child({ context: PostgresOrderRepositoryAdapter.name });

    constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

    async save(order: Order): Promise<void> {
        try {
            await this.db.insert(orders).values(PostgresOrderMapper.toDbRecord(order));
            this.logger.debug({ orderId: order.id.toString() }, 'Order saved');
        } catch (error) {
            this.handleSaveError(error, order);
        }
    }

    private handleSaveError(error: unknown, order: Order): never {
        if (this.isDuplicateActiveLevelError(error)) {
            throw new DuplicateActiveOrderError(
                order.gridId.toString(),
                order.levelIndex,
                order.side,
            );
        }
        this.logger.error({ error, orderId: order.id.toString() }, 'Failed to save order');
        throw error;
    }

    private isDuplicateActiveLevelError(error: unknown): boolean {
        const PG_UNIQUE_VIOLATION = '23505';
        return (
            error instanceof Error &&
            'code' in error &&
            (error as NodeJS.ErrnoException).code === PG_UNIQUE_VIOLATION &&
            error.message.includes('idx_orders_active_level')
        );
    }

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
            return rows.map((row) => PostgresOrderMapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error, gridId }, 'Failed to find active grid orders');
            throw error;
        }
    }

    async findManyByGridId(gridId: GridId): Promise<Order[]> {
        try {
            const result = await this.db
                .select()
                .from(orders)
                .where(eq(orders.gridId, gridId.toString()));
            return result.map((row) => PostgresOrderMapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error, gridId: gridId.toString() }, 'Failed to find orders');
            return [];
        }
    }

    async findOneByExchangeOrderId(exchangeOrderId: string): Promise<Order | null> {
        try {
            const rows = await this.db
                .select()
                .from(orders)
                .where(eq(orders.exchangeOrderId, exchangeOrderId))
                .limit(1);
            if (rows.length === 0) return null;
            return PostgresOrderMapper.toDomain(rows[0]);
        } catch (error) {
            this.logger.error({ error, exchangeOrderId }, 'Failed to find order by exchange ID');
            throw error;
        }
    }

    async updateStatus(orderId: string, status: OrderStatus, filledAt?: Date): Promise<void> {
        try {
            const updateData: Partial<OrderDbRecord> = { status, updatedAt: new Date() };
            if (status === OrderStatus.Filled && filledAt) updateData.filledAt = filledAt;
            if (status === OrderStatus.Cancelled) updateData.cancelledAt = new Date();
            await this.db.update(orders).set(updateData).where(eq(orders.id, orderId));
            this.logger.debug({ orderId, status }, 'Order status updated');
        } catch (error) {
            this.logger.error({ error, orderId, status }, 'Failed to update order status');
            throw error;
        }
    }

    async updateExchangeOrderId(
        orderId: string,
        exchangeOrderId: string,
        status: OrderStatus,
        placedAt: Date,
    ): Promise<void> {
        try {
            await this.db
                .update(orders)
                .set({ exchangeOrderId, status, placedAt, updatedAt: new Date() })
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

    async findManyByStatus(status: OrderStatus): Promise<Order[]> {
        try {
            const rows = await this.db.select().from(orders).where(eq(orders.status, status));
            return rows.map((row) => PostgresOrderMapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error, status }, 'Failed to find orders by status');
            throw error;
        }
    }

    async findManyByGridIds(gridIds: string[]): Promise<Order[]> {
        if (gridIds.length === 0) return [];
        try {
            const rows = await this.db.select().from(orders).where(inArray(orders.gridId, gridIds));
            return rows.map((row) => PostgresOrderMapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error, gridIds }, 'Failed to find orders by grid IDs');
            return [];
        }
    }

    async findManyPlacedByGridIds(gridIds: string[]): Promise<Order[]> {
        if (gridIds.length === 0) return [];
        try {
            const rows = await this.db
                .select()
                .from(orders)
                .where(
                    and(
                        inArray(orders.gridId, gridIds),
                        inArray(orders.status, [OrderStatus.Pending, OrderStatus.Placed]),
                    ),
                );
            return rows.map((row) => PostgresOrderMapper.toDomain(row));
        } catch (error) {
            this.logger.error({ error, gridIds }, 'Failed to find placed orders by grid IDs');
            return [];
        }
    }
}
