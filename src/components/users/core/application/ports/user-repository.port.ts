import { User } from '../../domain/models/user/user';
import { UserStatus } from '@domain/models/user/user-status';

export const USER_REPOSITORY_PORT = Symbol('USER_REPOSITORY_PORT');

export interface SaveUserData {
    telegramChatId: number;
    accountAddress: string;
    agentAddress: string;
    agentPrivateKeyEncrypted: string;
    status: UserStatus;
}

export interface UpdateAgentKeyAndStatusData {
    agentAddress: string;
    agentPrivateKeyEncrypted: string;
    status: UserStatus;
}

export interface UserRepositoryPort {
    save(user: SaveUserData): Promise<User>;
    findOneById(id: string): Promise<User | null>;
    findOneByChatId(chatId: number): Promise<User | null>;
    findOneByAccountAddress(address: string): Promise<User | null>;
    updateStatus(id: string, status: UserStatus): Promise<void>;
    updateTradeNotificationsEnabled(id: string, enabled: boolean): Promise<void>;
    updateAgentKeyAndStatus(id: string, data: UpdateAgentKeyAndStatusData): Promise<void>;
    findManyActive(): Promise<User[]>;
    findEncryptedAgentKey(userId: string): Promise<string>;
}
