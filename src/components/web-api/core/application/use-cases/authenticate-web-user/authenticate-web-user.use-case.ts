import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import { UserDto } from '@components/users/api/dto/user.dto';

/**
 * Resolves the website caller (Telegram id from a verified token) to a bot user, applying the same
 * single-user whitelist as the Telegram auth middleware. Users of any status are returned.
 */
@Injectable()
export class AuthenticateWebUserUseCase {
    private readonly allowedUserId: number | undefined;

    constructor(
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
        config: ConfigService<Config, true>,
    ) {
        this.allowedUserId = config.get('telegram', { infer: true }).allowedUserId;
    }

    async execute(telegramId: number): Promise<UserDto | null> {
        if (this.allowedUserId && telegramId !== this.allowedUserId) return null;
        return this.usersApi.findUserByChatId(telegramId);
    }
}
