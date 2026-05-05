import { Inject, Injectable } from '@nestjs/common';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import { UserDto } from '@components/users/api/dto/user.dto';

@Injectable()
export class ConnectAccountUseCase {
    constructor(@Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort) {}

    async execute(
        chatId: number,
        accountAddress: string,
    ): Promise<{ user: UserDto; agentAddress: string }> {
        return this.usersApi.createPendingUser(chatId, accountAddress);
    }
}
