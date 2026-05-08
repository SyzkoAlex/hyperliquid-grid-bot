import { boolean, decimal, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/**
 * Grids table for SPOT grid trading
 */
export const grids = pgTable('grids', {
    id: uuid('id').primaryKey().defaultRandom(),
    symbol: varchar('symbol', { length: 50 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(), // idle, running, stopped, error
    lowerPrice: decimal('lower_price', { precision: 20, scale: 8 }).notNull(),
    upperPrice: decimal('upper_price', { precision: 20, scale: 8 }).notNull(),
    levels: integer('levels').notNull(),
    investmentUSDC: decimal('investment_quote', { precision: 20, scale: 8 }).notNull(), // USD for buys
    investmentBase: decimal('investment_base', { precision: 20, scale: 8 }).notNull(), // Tokens for sells
    creationPrice: decimal('creation_price', { precision: 20, scale: 8 }),
    trailingEnabled: boolean('trailing_enabled').notNull().default(false),
    trailingTriggerPercent: decimal('trailing_trigger_percent', { precision: 5, scale: 2 }).default(
        '5',
    ),
    trailingStepPercent: decimal('trailing_step_percent', { precision: 5, scale: 2 }).default('10'),
    trailingPartialClosePercent: decimal('trailing_partial_close_percent', {
        precision: 5,
        scale: 2,
    }).default('50'),
    trailingCount: integer('trailing_count').notNull().default(0),
    lastTrailingAt: timestamp('last_trailing_at'),
    stopLossEnabled: boolean('stop_loss_enabled').notNull().default(false),
    stopLossPrice: decimal('stop_loss_price', { precision: 20, scale: 8 }),
    stopLossTriggeredAt: timestamp('stop_loss_triggered_at'),
    startedAt: timestamp('started_at'),
    stoppedAt: timestamp('stopped_at'),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Grid database record type
 */
export type GridDbRecord = typeof grids.$inferSelect;
