import { UserStatus } from '@domain/models/user/user-status';
import { User } from '../../domain/models/user';

export const USER_REPOSITORY_PORT = Symbol('USER_REPOSITORY_PORT');

export interface UserRepositoryPort {
    save(user: {
        telegramChatId: number;
        accountAddress: string;
        agentAddress: string;
        agentPrivateKeyEncrypted: string;
        status: UserStatus;
    }): Promise<User>;
    findOneById(id: string): Promise<User | null>;
    findOneByChatId(chatId: number): Promise<User | null>;
    findOneByAccountAddress(address: string): Promise<User | null>;
    updateStatus(id: string, status: UserStatus): Promise<void>;
    findManyActive(): Promise<User[]>;
    findEncryptedAgentKey(userId: string): Promise<string>;
}
