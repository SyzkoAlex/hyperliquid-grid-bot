import { bigint, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Users table for agent wallet integration.
 * Each user has an encrypted agent private key that cannot withdraw funds.
 */
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    telegramChatId: bigint('telegram_chat_id', { mode: 'number' }).notNull().unique(),
    accountAddress: varchar('account_address', { length: 42 }).notNull(),
    agentAddress: varchar('agent_address', { length: 42 }).notNull(),
    agentPrivateKeyEncrypted: varchar('agent_private_key_encrypted', { length: 500 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(), // pending_approval, active, disconnected
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type UserDbRecord = typeof users.$inferSelect;
