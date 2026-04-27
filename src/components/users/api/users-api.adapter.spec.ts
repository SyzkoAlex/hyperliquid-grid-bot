import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersApiAdapter } from './users-api.adapter';
import { UserStatus } from '@domain/models/user/user-status';
import { User } from '../core/domain/models/user';

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_CHAT_ID = 123456789;
const MOCK_ACCOUNT_ADDRESS = '0x1234567890123456789012345678901234567890';
const MOCK_AGENT_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

function makeUserFull(status: UserStatus = UserStatus.PendingApproval): User {
    return new User(
        MOCK_USER_ID,
        MOCK_CHAT_ID,
        MOCK_ACCOUNT_ADDRESS,
        MOCK_AGENT_ADDRESS,
        status,
        new Date('2024-01-01'),
    );
}

describe('UsersApiAdapter', () => {
    let sut: UsersApiAdapter;

    let mockRepo: {
        save: ReturnType<typeof vi.fn>;
        findOneById: ReturnType<typeof vi.fn>;
        findOneByChatId: ReturnType<typeof vi.fn>;
        findOneByAccountAddress: ReturnType<typeof vi.fn>;
        findManyActive: ReturnType<typeof vi.fn>;
        updateStatus: ReturnType<typeof vi.fn>;
        findEncryptedAgentKey: ReturnType<typeof vi.fn>;
    };

    let mockAgentKey: {
        generateKeyPair: ReturnType<typeof vi.fn>;
        encryptPrivateKey: ReturnType<typeof vi.fn>;
        decryptPrivateKey: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockRepo = {
            save: vi.fn(),
            findOneById: vi.fn(),
            findOneByChatId: vi.fn(),
            findOneByAccountAddress: vi.fn(),
            findManyActive: vi.fn(),
            updateStatus: vi.fn().mockResolvedValue(undefined),
            findEncryptedAgentKey: vi.fn(),
        };

        mockAgentKey = {
            generateKeyPair: vi.fn().mockReturnValue({
                privateKey: '0x' + 'ab'.repeat(32),
                address: MOCK_AGENT_ADDRESS,
            }),
            encryptPrivateKey: vi.fn().mockReturnValue('encrypted-key'),
            decryptPrivateKey: vi.fn().mockReturnValue('0x' + 'ab'.repeat(32)),
        };

        sut = new UsersApiAdapter(mockRepo as any, mockAgentKey as any);
    });

    describe('findUserById', () => {
        it('should return null when repo returns null', async () => {
            mockRepo.findOneById.mockResolvedValue(null);
            const result = await sut.findUserById(MOCK_USER_ID);
            expect(result).toBeNull();
        });

        it('should return dto when user found', async () => {
            mockRepo.findOneById.mockResolvedValue(makeUserFull());
            const result = await sut.findUserById(MOCK_USER_ID);
            expect(result).not.toBeNull();
            expect(result!.id).toBe(MOCK_USER_ID);
            expect(result!.accountAddress).toBe(MOCK_ACCOUNT_ADDRESS);
        });
    });

    describe('findUserByChatId', () => {
        it('should return null when repo returns null', async () => {
            mockRepo.findOneByChatId.mockResolvedValue(null);
            const result = await sut.findUserByChatId(MOCK_CHAT_ID);
            expect(result).toBeNull();
        });

        it('should return dto when user found', async () => {
            mockRepo.findOneByChatId.mockResolvedValue(makeUserFull());
            const result = await sut.findUserByChatId(MOCK_CHAT_ID);
            expect(result).not.toBeNull();
            expect(result!.telegramChatId).toBe(MOCK_CHAT_ID);
        });
    });

    describe('createPendingUser', () => {
        it('should generate key pair, encrypt, save, and return user + agentAddress', async () => {
            const savedUser = makeUserFull();
            mockRepo.save.mockResolvedValue(savedUser);

            const { user, agentAddress } = await sut.createPendingUser(
                MOCK_CHAT_ID,
                MOCK_ACCOUNT_ADDRESS,
            );

            expect(mockAgentKey.generateKeyPair).toHaveBeenCalledOnce();
            expect(mockAgentKey.encryptPrivateKey).toHaveBeenCalledWith('0x' + 'ab'.repeat(32));
            expect(mockRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    telegramChatId: MOCK_CHAT_ID,
                    accountAddress: MOCK_ACCOUNT_ADDRESS,
                    agentAddress: MOCK_AGENT_ADDRESS,
                    agentPrivateKeyEncrypted: 'encrypted-key',
                    status: UserStatus.PendingApproval,
                }),
            );
            expect(user.id).toBe(MOCK_USER_ID);
            expect(agentAddress).toBe(MOCK_AGENT_ADDRESS);
        });
    });

    describe('activateUser', () => {
        it('should call updateStatus with Active', async () => {
            await sut.activateUser(MOCK_USER_ID);
            expect(mockRepo.updateStatus).toHaveBeenCalledWith(MOCK_USER_ID, UserStatus.Active);
        });
    });

    describe('getAgentPrivateKey', () => {
        it('should fetch encrypted key from repo and decrypt via agentKeyPort', async () => {
            mockRepo.findEncryptedAgentKey.mockResolvedValue('encrypted-blob');
            mockAgentKey.decryptPrivateKey.mockReturnValue('decrypted-key');

            const result = await sut.getAgentPrivateKey(MOCK_USER_ID);

            expect(mockRepo.findEncryptedAgentKey).toHaveBeenCalledWith(MOCK_USER_ID);
            expect(mockAgentKey.decryptPrivateKey).toHaveBeenCalledWith('encrypted-blob');
            expect(result).toBe('decrypted-key');
        });

        it('should propagate errors from decryptPrivateKey', async () => {
            mockRepo.findEncryptedAgentKey.mockResolvedValue('bad-data');
            mockAgentKey.decryptPrivateKey.mockImplementation(() => {
                throw new Error('Decryption failed');
            });

            await expect(sut.getAgentPrivateKey(MOCK_USER_ID)).rejects.toThrow('Decryption failed');
        });
    });
});
