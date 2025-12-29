import { Injectable } from '@nestjs/common';
import { Order } from '../../../core/domain/order/order';
import { OrderId } from '../../../core/domain/order/order-id';
import { OrderSide } from '../../../core/domain/order/order-side';
import { OrderType } from '../../../core/domain/order/order-type';
import { OrderStatus } from '../../../core/domain/order/order-status';
import { Symbol } from '../../../core/domain/common/symbol';
import { Price } from '../../../core/domain/common/price';
import { Decimal } from '../../../../../domain/primitives/decimal';
import { Timestamp } from '../../../../../domain/primitives/timestamp';
import { ExchangeCloid } from '../../../core/domain/exchange-order/exchange-cloid';
import { OrderDbRecord } from '../../../../../infra/database/schema';

/**
 * Postgres Order Mapper
 * Maps between Order domain entities and database records
 */
@Injectable()
export class PostgresOrderMapper {
    /**
     * Convert database row to domain entity
     */
    toDomain(row: OrderDbRecord): Order {
        // Parse cloid from database (hex string) back to ExchangeCloid value object
        const parsedGridId = ExchangeCloid.parse(row.cloid ?? undefined);
        const cloid = parsedGridId ? ExchangeCloid.create(parsedGridId) : undefined;

        return Order.create({
            id: OrderId.from(row.id),
            exchangeOrderId: row.exchangeOrderId ?? undefined,
            cloid,
            symbol: Symbol.create(row.symbol || 'UNKNOWN'),
            type: (row.type as OrderType) || OrderType.Limit,
            side: row.side as OrderSide,
            price: row.price ? Price.from(parseFloat(row.price)) : undefined,
            amount: Decimal.from(row.amount),
            filledAmount: Decimal.from(row.filledAmount ?? '0'),
            status: row.status as OrderStatus,
            gridId: row.gridId,
            levelIndex: row.levelIndex,
            placedAt: row.placedAt ? Timestamp.from(row.placedAt) : undefined,
            filledAt: row.filledAt ? Timestamp.from(row.filledAt) : undefined,
            cancelledAt: row.cancelledAt ? Timestamp.from(row.cancelledAt) : undefined,
        });
    }

    /**
     * Convert domain entity to database record
     */
    toDbRecord(order: Order): Omit<OrderDbRecord, 'createdAt' | 'updatedAt'> {
        return {
            id: order.id.toString(),
            exchangeOrderId: order.exchangeOrderId ?? null,
            cloid: order.cloid ? order.cloid.toString() : null,
            symbol: order.symbol.toString(),
            type: order.type,
            side: order.side,
            price: order.price?.toString() ?? null,
            amount: order.amount.toString(),
            filledAmount: order.filledAmount.toString(),
            status: order.status,
            gridId: order.gridId,
            levelIndex: order.levelIndex,
            placedAt: order.placedAt?.toDate() ?? null,
            filledAt: order.filledAt?.toDate() ?? null,
            cancelledAt: order.cancelledAt?.toDate() ?? null,
        };
    }
}
