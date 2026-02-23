import { Injectable, Inject } from '@nestjs/common';
import { TelegramOrderRepositoryPort } from '@components/telegram/core/application/ports/order-repository.port';
import type { DrizzleDb } from '@adapters/outbound/database/drizzle-db';
import { DRIZZLE_DB } from '@adapters/outbound/database/database.module';
import { Order } from '@domain/models/order/order';
import { OrderId } from '@domain/models/order/order-id';
import { GridId } from '@domain/models/grid/grid-id';
import { orders } from '@adapters/outbound/database/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '@/infra/logger/logger';
import { PostgresOrderMapper } from '@adapters/outbound/database/mappers/postgres-order.mapper';

/**
 * Postgres Order Repository (Telegram Component - Read-Only)
 */
@Injectable()
export class PostgresOrderRepositoryAdapter implements TelegramOrderRepositoryPort {
    private readonly logger = logger.child({ context: PostgresOrderRepositoryAdapter.name });

    constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

    async findOneById(id: OrderId): Promise<Order | null> {
        try {
            const result = await this.db
                .select()
                .from(orders)
                .where(eq(orders.id, id.toString()))
                .limit(1);

            if (result.length === 0) return null;

            return PostgresOrderMapper.toDomain(result[0]);
        } catch (error) {
            this.logger.error({ error, orderId: id.toString() }, 'Failed to find order');
            return null;
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

    async findManyByGridIdAndStatus(gridId: GridId, status: string): Promise<Order[]> {
        try {
            const result = await this.db
                .select()
                .from(orders)
                .where(and(eq(orders.gridId, gridId.toString()), eq(orders.status, status)));

            return result.map((row) => PostgresOrderMapper.toDomain(row));
        } catch (error) {
            this.logger.error(
                { error, gridId: gridId.toString(), status },
                'Failed to find orders',
            );
            return [];
        }
    }
}
