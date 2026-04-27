import { UserStatus } from '@domain/models/user/user-status';

export interface UserDto {
    id: string;
    telegramChatId: number;
    accountAddress: string;
    agentAddress: string;
    status: UserStatus;
}
