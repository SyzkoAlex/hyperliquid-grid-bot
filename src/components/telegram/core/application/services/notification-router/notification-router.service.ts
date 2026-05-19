import { Inject, Injectable } from '@nestjs/common';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
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
        const userId = await this.resolveUserId(event);
        if (!userId) return null;

        const user = await this.usersApi.findUserById(userId);
        if (!user) {
            this.logger.warn(
                { userId, eventType: event.eventType },
                'User not found for notification event',
            );
            return null;
        }
        return {
            chatId: user.telegramChatId,
            tradeNotificationsEnabled: user.tradeNotificationsEnabled,
        };
    }

    private async resolveUserId(event: SerializableEvent): Promise<string | null> {
        if (event instanceof GridCreatedErrorEvent) {
            if (!event.accountAddress) {
                this.logger.warn(
                    { eventType: event.eventType },
                    'GridCreatedErrorEvent has no accountAddress — cannot route notification',
                );
                return null;
            }
            const user = await this.usersApi.findUserByAccountAddress(event.accountAddress);
            if (!user) {
                this.logger.warn(
                    { accountAddress: event.accountAddress },
                    'User not found by accountAddress for GridCreatedError event',
                );
                return null;
            }
            return user.id;
        }

        const gridId = this.extractGridId(event);
        if (!gridId) {
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
        return grid.userId;
    }

    private extractGridId(event: SerializableEvent): string | null {
        const e = event as unknown as Record<string, unknown>;
        if (typeof e['gridId'] === 'string') return e['gridId'];
        return null;
    }
}
