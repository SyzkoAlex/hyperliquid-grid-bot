import { UserStatus } from '@domain/models/user/user-status';

export class User {
    constructor(
        readonly id: string,
        readonly telegramChatId: number,
        readonly accountAddress: string,
        readonly agentAddress: string,
        readonly status: UserStatus,
        readonly createdAt: Date,
    ) {}
}
