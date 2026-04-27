import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleDb } from '@/infra/database/drizzle-db';
import { DRIZZLE_DB } from '@/infra/database/database.module';
import { users } from '@/infra/database/schema';
import { logger } from '@/infra/logger/logger';
import { UserStatus } from '@domain/models/user/user-status';
import { User } from '../../../core/domain/models/user';
import { UserRepositoryPort } from '../../../core/application/ports/user-repository.port';

@Injectable()
export class PostgresUserRepositoryAdapter implements UserRepositoryPort {
    private readonly logger = logger.child({ context: PostgresUserRepositoryAdapter.name });

    constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

    async save(user: {
        telegramChatId: number;
        accountAddress: string;
        agentAddress: string;
        agentPrivateKeyEncrypted: string;
        status: UserStatus;
    }): Promise<User> {
        try {
            const result = await this.db
                .insert(users)
                .values({
                    telegramChatId: user.telegramChatId,
                    accountAddress: user.accountAddress,
                    agentAddress: user.agentAddress,
                    agentPrivateKeyEncrypted: user.agentPrivateKeyEncrypted,
                    status: user.status,
                })
                .returning();

            const record = result[0];
            this.logger.info({ userId: record.id, chatId: user.telegramChatId }, 'User saved');
            return this.toDomain(record);
        } catch (error) {
            this.logger.error({ error, chatId: user.telegramChatId }, 'Failed to save user');
            throw error;
        }
    }

    async findOneById(id: string): Promise<User | null> {
        const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
        return result.length > 0 ? this.toDomain(result[0]) : null;
    }

    async findOneByChatId(chatId: number): Promise<User | null> {
        const result = await this.db
            .select()
            .from(users)
            .where(eq(users.telegramChatId, chatId))
            .limit(1);
        return result.length > 0 ? this.toDomain(result[0]) : null;
    }

    async findOneByAccountAddress(address: string): Promise<User | null> {
        const result = await this.db
            .select()
            .from(users)
            .where(eq(users.accountAddress, address))
            .limit(1);
        return result.length > 0 ? this.toDomain(result[0]) : null;
    }

    async updateStatus(id: string, status: UserStatus): Promise<void> {
        await this.db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, id));
        this.logger.info({ userId: id, status }, 'User status updated');
    }

    async findManyActive(): Promise<User[]> {
        const result = await this.db
            .select()
            .from(users)
            .where(eq(users.status, UserStatus.Active));
        return result.map((r) => this.toDomain(r));
    }

    async findEncryptedAgentKey(userId: string): Promise<string> {
        const result = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);

        if (result.length === 0) {
            throw new Error(`User not found: ${userId}`);
        }

        return result[0].agentPrivateKeyEncrypted;
    }

    private toDomain(record: typeof users.$inferSelect): User {
        return new User(
            record.id,
            Number(record.telegramChatId),
            record.accountAddress,
            record.agentAddress,
            record.status as UserStatus,
            record.createdAt,
        );
    }
}
