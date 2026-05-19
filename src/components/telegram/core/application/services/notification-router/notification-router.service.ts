import { Inject, Injectable } from '@nestjs/common';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import { SerializableEvent } from '@domain/models/events/trading/trading-event';
import { logger } from '@/infra/logger/logger';
import { NotificationRoute } from './types/notification-route';

/**
 * Resolves the destination chat for a trade notification event via event.userId.
 * Returns null when the user cannot be found; the failure is logged at WARN level.
 */
@Injectable()
export class NotificationRouterService {
    private readonly logger = logger.child({ context: NotificationRouterService.name });

    constructor(@Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort) {}

    async resolve(event: SerializableEvent): Promise<NotificationRoute | null> {
        const user = await this.usersApi.findUserById(event.userId);
        if (!user) {
            this.logger.warn(
                { userId: event.userId, eventType: event.eventType },
                'User not found for notification event',
            );
            return null;
        }
        return {
            chatId: user.telegramChatId,
            tradeNotificationsEnabled: user.tradeNotificationsEnabled,
        };
    }
}
