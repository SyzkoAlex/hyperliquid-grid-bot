import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DrizzleDb } from '@/infra/database/drizzle-db';
import { DatabaseTestHelper } from '@/infra/tests/database-test-helper';
import { PostgresUserRepositoryAdapter } from './postgres-user-repository.adapter';
import { UserStatus } from '@domain/models/user/user-status';

const CHAT_ID = 100000001;
const ACCOUNT_ADDRESS = '0x1111111111111111111111111111111111111111';
const AGENT_ADDRESS = '0x2222222222222222222222222222222222222222';
const ENCRYPTED_KEY = 'test-encrypted-private-key';

function makeSavePayload(
    overrides: Partial<{
        telegramChatId: number;
        accountAddress: string;
        agentAddress: string;
        agentPrivateKeyEncrypted: string;
        status: UserStatus;
    }> = {},
) {
    return {
        telegramChatId: CHAT_ID,
        accountAddress: ACCOUNT_ADDRESS,
        agentAddress: AGENT_ADDRESS,
        agentPrivateKeyEncrypted: ENCRYPTED_KEY,
        status: UserStatus.PendingApproval,
        ...overrides,
    };
}

describe('PostgresUserRepositoryAdapter (Integration)', () => {
    let db: DrizzleDb;
    let repository: PostgresUserRepositoryAdapter;

    beforeAll(async () => {
        db = await DatabaseTestHelper.initialize();
        repository = new PostgresUserRepositoryAdapter(db);
    }, 120_000);

    beforeEach(async () => {
        await DatabaseTestHelper.cleanup();
    });

    afterEach(async () => {
        await DatabaseTestHelper.cleanup();
    });

    afterAll(async () => {
        await DatabaseTestHelper.close();
    });

    describe('save', () => {
        it('should insert a user row and return a User domain model', async () => {
            const user = await repository.save(makeSavePayload());

            expect(user.id).toBeDefined();
            expect(user.telegramChatId).toBe(CHAT_ID);
            expect(user.accountAddress).toBe(ACCOUNT_ADDRESS);
            expect(user.agentAddress).toBe(AGENT_ADDRESS);
            expect(user.status).toBe(UserStatus.PendingApproval);
            expect(user.tradeNotificationsEnabled).toBe(true);
            expect(user.createdAt).toBeInstanceOf(Date);
        });
    });

    describe('findOneById', () => {
        it('should return the user after saving', async () => {
            const saved = await repository.save(makeSavePayload());
            const found = await repository.findOneById(saved.id);

            expect(found).not.toBeNull();
            expect(found!.id).toBe(saved.id);
        });

        it('should return null for a non-existent id', async () => {
            const result = await repository.findOneById('00000000-0000-0000-0000-000000000099');
            expect(result).toBeNull();
        });
    });

    describe('findOneByChatId', () => {
        it('should return user when found', async () => {
            await repository.save(makeSavePayload());
            const found = await repository.findOneByChatId(CHAT_ID);

            expect(found).not.toBeNull();
            expect(found!.telegramChatId).toBe(CHAT_ID);
        });

        it('should return null when not found', async () => {
            const result = await repository.findOneByChatId(999999999);
            expect(result).toBeNull();
        });
    });

    describe('findOneByAccountAddress', () => {
        it('should return user when found', async () => {
            await repository.save(makeSavePayload());
            const found = await repository.findOneByAccountAddress(ACCOUNT_ADDRESS);

            expect(found).not.toBeNull();
            expect(found!.accountAddress).toBe(ACCOUNT_ADDRESS);
        });

        it('should return null when not found', async () => {
            const result = await repository.findOneByAccountAddress(
                '0x0000000000000000000000000000000000000000',
            );
            expect(result).toBeNull();
        });
    });

    describe('findManyActive', () => {
        it('should return only users with Active status', async () => {
            await repository.save(makeSavePayload({ status: UserStatus.PendingApproval }));
            const active = await repository.save(
                makeSavePayload({
                    telegramChatId: CHAT_ID + 1,
                    accountAddress: '0x' + 'a'.repeat(40),
                    status: UserStatus.Active,
                }),
            );
            await repository.save(
                makeSavePayload({
                    telegramChatId: CHAT_ID + 2,
                    accountAddress: '0x' + 'b'.repeat(40),
                    status: UserStatus.Disconnected,
                }),
            );

            const result = await repository.findManyActive();

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(active.id);
        });

        it('should return empty array when no active users', async () => {
            await repository.save(makeSavePayload({ status: UserStatus.PendingApproval }));
            const result = await repository.findManyActive();
            expect(result).toHaveLength(0);
        });
    });

    describe('updateStatus', () => {
        it('should update the status field', async () => {
            const saved = await repository.save(makeSavePayload());
            expect(saved.status).toBe(UserStatus.PendingApproval);

            await repository.updateStatus(saved.id, UserStatus.Active);
            const updated = await repository.findOneById(saved.id);

            expect(updated!.status).toBe(UserStatus.Active);
        });
    });

    describe('updateTradeNotificationsEnabled', () => {
        it('defaults to true on save', async () => {
            const saved = await repository.save(makeSavePayload());
            expect(saved.tradeNotificationsEnabled).toBe(true);
        });

        it('updates the trade_notifications_enabled column', async () => {
            const saved = await repository.save(makeSavePayload());
            await repository.updateTradeNotificationsEnabled(saved.id, false);
            const updated = await repository.findOneById(saved.id);
            expect(updated!.tradeNotificationsEnabled).toBe(false);
        });
    });

    describe('findEncryptedAgentKey', () => {
        it('should return the encrypted key string', async () => {
            const saved = await repository.save(makeSavePayload());
            const key = await repository.findEncryptedAgentKey(saved.id);
            expect(key).toBe(ENCRYPTED_KEY);
        });

        it('should throw when user not found', async () => {
            await expect(
                repository.findEncryptedAgentKey('00000000-0000-0000-0000-000000000099'),
            ).rejects.toThrow('User not found');
        });
    });
});
