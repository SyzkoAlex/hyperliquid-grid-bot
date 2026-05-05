import { UserStatus } from '@domain/models/user/user-status';

export interface UserCreateParams {
    id: string;
    telegramChatId: number;
    accountAddress: string;
    agentAddress: string;
    status: UserStatus;
    createdAt: Date;
}
