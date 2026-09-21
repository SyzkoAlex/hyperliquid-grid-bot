import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { AuthenticateWebUserUseCase } from './authenticate-web-user.use-case';
import { UsersApiPort } from '@components/users/api/users-api.port';
import { UserDto } from '@components/users/api/dto/user.dto';
import { UserStatus } from '@domain/models/user/user-status';

const TELEGRAM_ID = 100000001;

function makeUser(status = UserStatus.Active): UserDto {
    return {
        id: 'user-1',
        telegramChatId: TELEGRAM_ID,
        accountAddress: '0xabc',
        agentAddress: '0xdef',
        status,
        timezone: 'UTC',
        tradeNotificationsEnabled: true,
    };
}

function makeConfig(allowedUserId: number | undefined): ConfigService<Config, true> {
    return { get: vi.fn().mockReturnValue({ allowedUserId }) } as unknown as ConfigService<
        Config,
        true
    >;
}

describe('AuthenticateWebUserUseCase', () => {
    let usersApi: { findUserByChatId: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        usersApi = { findUserByChatId: vi.fn().mockResolvedValue(makeUser()) };
    });

    function createUseCase(allowedUserId: number | undefined): AuthenticateWebUserUseCase {
        return new AuthenticateWebUserUseCase(
            usersApi as unknown as UsersApiPort,
            makeConfig(allowedUserId),
        );
    }

    it('returns null without lookup when the whitelist is set and differs', async () => {
        const result = await createUseCase(999).execute(TELEGRAM_ID);

        expect(result).toBeNull();
        expect(usersApi.findUserByChatId).not.toHaveBeenCalled();
    });

    it('looks up the user when the whitelist matches', async () => {
        const result = await createUseCase(TELEGRAM_ID).execute(TELEGRAM_ID);

        expect(result?.id).toBe('user-1');
    });

    it('looks up the user by chat id when the whitelist is unset', async () => {
        const result = await createUseCase(undefined).execute(TELEGRAM_ID);

        expect(usersApi.findUserByChatId).toHaveBeenCalledWith(TELEGRAM_ID);
        expect(result?.id).toBe('user-1');
    });

    it('returns null for an unknown user', async () => {
        usersApi.findUserByChatId.mockResolvedValue(null);

        const result = await createUseCase(undefined).execute(TELEGRAM_ID);

        expect(result).toBeNull();
    });

    it('returns a non-active user as is', async () => {
        usersApi.findUserByChatId.mockResolvedValue(makeUser(UserStatus.AgentExpired));

        const result = await createUseCase(undefined).execute(TELEGRAM_ID);

        expect(result?.status).toBe(UserStatus.AgentExpired);
    });
});
