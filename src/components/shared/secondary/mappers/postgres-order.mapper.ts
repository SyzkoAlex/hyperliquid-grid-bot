import { Order } from '@domain/order/order';
import { OrderId } from '@domain/order/order-id';
import { OrderSide } from '@domain/order/order-side';
import { OrderType } from '@domain/order/order-type';
import { OrderStatus } from '@domain/order/order-status';
import { TradingSymbol } from '@domain/primitives/trading-symbol';
import { Price } from '@domain/primitives/price';
import { Decimal } from '@domain/primitives/decimal';
import { Timestamp } from '@domain/primitives/timestamp';
import { OrderDbRecord } from '@infra/database/schema';
import { GridId } from '@domain/grid/grid-id';

/**
 * Postgres Order Mapper
 * Maps between Order domain entities and database records
 */
export class PostgresOrderMapper {
    /**
     * Convert database row to domain entity
     */
    static toDomain(row: OrderDbRecord): Order {
        return Order.create({
            id: OrderId.from(row.id),
            exchangeOrderId: row.exchangeOrderId ?? undefined,
            symbol: TradingSymbol.create(row.symbol || 'UNKNOWN'),
            type: (row.type as OrderType) || OrderType.Limit,
            side: row.side as OrderSide,
            price: row.price ? Price.from(parseFloat(row.price)) : undefined,
            amount: Decimal.from(row.amount),
            filledAmount: Decimal.from(row.filledAmount ?? '0'),
            status: row.status as OrderStatus,
            gridId: GridId.from(row.gridId),
            levelIndex: row.levelIndex,
            placedAt: row.placedAt ? Timestamp.from(row.placedAt) : undefined,
            filledAt: row.filledAt ? Timestamp.from(row.filledAt) : undefined,
            cancelledAt: row.cancelledAt ? Timestamp.from(row.cancelledAt) : undefined,
        });
    }

    /**
     * Convert domain entity to database record
     */
    static toDbRecord(order: Order): Omit<OrderDbRecord, 'createdAt' | 'updatedAt'> {
        return {
            id: order.id.toString(),
            exchangeOrderId: order.exchangeOrderId ?? null,
            symbol: order.symbol.toString(),
            type: order.type,
            side: order.side,
            price: order.price?.toString() ?? null,
            amount: order.amount.toString(),
            filledAmount: order.filledAmount.toString(),
            status: order.status,
            gridId: order.gridId.toString(),
            levelIndex: order.levelIndex,
            placedAt: order.placedAt?.toDate() ?? null,
            filledAt: order.filledAt?.toDate() ?? null,
            cancelledAt: order.cancelledAt?.toDate() ?? null,
        };
    }
}
