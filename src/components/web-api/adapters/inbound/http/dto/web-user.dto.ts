import { UserStatus } from '@domain/models/user/user-status';

export interface WebUserDto {
    telegramId: number;
    status: UserStatus;
    accountAddress: string;
    isConnected: boolean;
}
