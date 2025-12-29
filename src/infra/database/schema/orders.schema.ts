import { pgTable, uuid, varchar, decimal, timestamp, integer } from 'drizzle-orm/pg-core';
import { grids } from './grids.schema';

/**
 * Orders table
 * Stores only grid orders (gridId and levelIndex are required)
 */
export const orders = pgTable('orders', {
    id: uuid('id').primaryKey().defaultRandom(),
    exchangeOrderId: varchar('exchange_order_id', { length: 255 }).unique(),
    symbol: varchar('symbol', { length: 50 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // limit, market
    side: varchar('side', { length: 10 }).notNull(), // buy, sell
    price: decimal('price', { precision: 20, scale: 8 }),
    amount: decimal('amount', { precision: 20, scale: 8 }).notNull(),
    filledAmount: decimal('filled_amount', { precision: 20, scale: 8 }).default('0'),
    status: varchar('status', { length: 20 }).notNull(),

    // Grid fields (required - only grid orders are stored)
    gridId: uuid('grid_id')
        .notNull()
        .references(() => grids.id, { onDelete: 'cascade' }),
    levelIndex: integer('level_index').notNull(),

    // CLOID (Client Order ID) - hex-encoded gridId sent to exchange
    // Format: 0x{gridId without dashes}
    cloid: varchar('cloid', { length: 66 }),

    placedAt: timestamp('placed_at'),
    filledAt: timestamp('filled_at'),
    cancelledAt: timestamp('cancelled_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
export type OrderDbRecord = typeof orders.$inferSelect;
