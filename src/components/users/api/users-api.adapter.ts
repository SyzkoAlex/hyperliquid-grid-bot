import { Inject, Injectable } from '@nestjs/common';
import { UserStatus } from '@domain/models/user/user-status';
import { User } from '../core/domain/models/user/user';
import {
    USER_REPOSITORY_PORT,
    UserRepositoryPort,
} from '../core/application/ports/user-repository.port';
import { AGENT_KEY_PORT, AgentKeyPort } from '../core/application/ports/agent-key.port';
import { UsersApiPort } from './users-api.port';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UsersApiAdapter implements UsersApiPort {
    constructor(
        @Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort,
        @Inject(AGENT_KEY_PORT) private readonly agentKeyPort: AgentKeyPort,
    ) {}

    async findUserById(userId: string): Promise<UserDto | null> {
        const user = await this.userRepo.findOneById(userId);
        return user ? this.toDto(user) : null;
    }

    async findUserByChatId(chatId: number): Promise<UserDto | null> {
        const user = await this.userRepo.findOneByChatId(chatId);
        return user ? this.toDto(user) : null;
    }

    async findUserByAccountAddress(accountAddress: string): Promise<UserDto | null> {
        const user = await this.userRepo.findOneByAccountAddress(accountAddress);
        return user ? this.toDto(user) : null;
    }

    async findActiveUsers(): Promise<UserDto[]> {
        const userList = await this.userRepo.findManyActive();
        return userList.map((u) => this.toDto(u));
    }

    async getAgentPrivateKey(userId: string): Promise<string> {
        const encrypted = await this.userRepo.findEncryptedAgentKey(userId);
        return this.agentKeyPort.decryptPrivateKey(encrypted);
    }

    async createPendingUser(
        chatId: number,
        accountAddress: string,
    ): Promise<{ user: UserDto; agentAddress: string }> {
        const keyPair = this.agentKeyPort.generateKeyPair();
        const encryptedKey = this.agentKeyPort.encryptPrivateKey(keyPair.privateKey);

        const user = await this.userRepo.save({
            telegramChatId: chatId,
            accountAddress,
            agentAddress: keyPair.address,
            agentPrivateKeyEncrypted: encryptedKey,
            status: UserStatus.PendingApproval,
        });

        return { user: this.toDto(user), agentAddress: keyPair.address };
    }

    async activateUser(userId: string): Promise<void> {
        await this.userRepo.updateStatus(userId, UserStatus.Active);
    }

    async disconnectUser(userId: string): Promise<void> {
        await this.userRepo.updateStatus(userId, UserStatus.Disconnected);
    }

    private toDto(user: User): UserDto {
        return {
            id: user.id,
            telegramChatId: user.telegramChatId,
            accountAddress: user.accountAddress,
            agentAddress: user.agentAddress,
            status: user.status,
        };
    }
}
