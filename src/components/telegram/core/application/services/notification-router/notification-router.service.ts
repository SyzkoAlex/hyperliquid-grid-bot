import { Inject, Injectable } from '@nestjs/common';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import { UserDto } from '@components/users/api/dto/user.dto';
import { SerializableEvent } from '@domain/models/events/trading/trading-event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';
import { logger } from '@/infra/logger/logger';
import { NotificationRoute } from './types/notification-route';

/**
 * Resolves the destination chat for a trade notification event.
 *
 * - Events with a gridId → grid.userId → user.
 * - GridCreatedErrorEvent → user via accountAddress (no gridId exists yet).
 *
 * Returns null when grid or user cannot be resolved; the failure is logged at WARN level.
 */
@Injectable()
export class NotificationRouterService {
    private readonly logger = logger.child({ context: NotificationRouterService.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly gridsApi: GridsApiPort,
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
    ) {}

    async resolve(event: SerializableEvent): Promise<NotificationRoute | null> {
        const user =
            event instanceof GridCreatedErrorEvent
                ? await this.userFromAccountAddress(event)
                : await this.userFromGrid(event);
        if (!user) return null;
        return {
            chatId: user.telegramChatId,
            tradeNotificationsEnabled: user.tradeNotificationsEnabled,
        };
    }

    private async userFromAccountAddress(event: GridCreatedErrorEvent): Promise<UserDto | null> {
        if (!event.accountAddress) {
            this.logger.warn(
                { eventType: event.eventType },
                'GridCreatedErrorEvent missing accountAddress',
            );
            return null;
        }
        const user = await this.usersApi.findUserByAccountAddress(event.accountAddress);
        if (!user)
            this.logger.warn(
                { accountAddress: event.accountAddress },
                'User not found by accountAddress',
            );
        return user;
    }

    private async userFromGrid(event: SerializableEvent): Promise<UserDto | null> {
        const gridId = (event as unknown as Record<string, unknown>)['gridId'];
        if (typeof gridId !== 'string') {
            this.logger.warn(
                { eventType: event.eventType },
                'Event has no gridId — cannot route notification',
            );
            return null;
        }
        const grid = await this.gridsApi.findGridById(gridId);
        if (!grid) {
            this.logger.warn(
                { gridId, eventType: event.eventType },
                'Grid not found for notification event',
            );
            return null;
        }
        const user = await this.usersApi.findUserById(grid.userId);
        if (!user)
            this.logger.warn(
                { userId: grid.userId, eventType: event.eventType },
                'User not found for notification event',
            );
        return user;
    }
}
