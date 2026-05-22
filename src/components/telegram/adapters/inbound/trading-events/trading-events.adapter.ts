import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
    EVENT_SUBSCRIBER_PORT,
    EventSubscriberPort,
} from '@/core/application/ports/inbound/event-subscriber.port';
import { SerializableEvent } from '@domain/models/events/trading/trading-event';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';
import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';
import { GridStopLossTriggeredEvent } from '@domain/models/events/trading/grid-stop-loss-triggered.event';
import { AgentApprovalLostEvent } from '@domain/models/events/trading/agent-approval-lost.event';
import { EventDeserializer } from '@domain/models/events/event-deserializer';
import { EventType } from '@domain/models/events/event-type';
import { NotifyUserUseCase } from '@components/telegram/core/application/use-cases/notify-user/notify-user.use-case';
import { NotificationMessageFactory } from '@components/telegram/core/domain/models/messages/notifications/notification-message.factory';
import { AgentApprovalLostMessage } from '@components/telegram/core/domain/models/messages/notifications/agent-approval-lost-message';
import { TelegramBotService } from '@components/telegram/adapters/inbound/telegram-bot/telegram-bot.service';
import { PendingCreationMessageStore } from '@components/telegram/adapters/inbound/telegram-bot/pending-creation-message.store';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import { logger } from '@/infra/logger/logger';

/**
 * Trading Events Adapter (SPOT Trading)
 *
 * Listens to events from Trading component and sends Telegram notifications.
 */
@Injectable()
export class TradingEventsAdapter implements OnModuleInit {
    private readonly logger = logger.child({ context: TradingEventsAdapter.name });

    constructor(
        @Inject(EVENT_SUBSCRIBER_PORT) private readonly subscriber: EventSubscriberPort,
        private readonly deserializer: EventDeserializer,
        private readonly notifyUser: NotifyUserUseCase,
        private readonly messageFactory: NotificationMessageFactory,
        private readonly botService: TelegramBotService,
        private readonly pendingCreationMessageStore: PendingCreationMessageStore,
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
    ) {}

    onModuleInit() {
        this.subscribeToEvents();
        this.logger.info('Trading events consumer initialized');
    }

    private subscribeToEvents() {
        this.subscribeEvent<OrderOpenedEvent>(EventType.OrderOpened, (e) =>
            this.notifyUser.execute({ event: e }),
        );
        this.subscribeEvent<OrderClosedEvent>(EventType.OrderClosed, (e) =>
            this.notifyUser.execute({ event: e }),
        );
        this.subscribeEvent<GridCreatedSuccessEvent>(EventType.GridCreatedSuccess, (e) =>
            this.notifyCreationResult(e),
        );
        this.subscribeEvent<GridCreatedErrorEvent>(EventType.GridCreatedError, (e) =>
            this.notifyCreationResult(e),
        );
        this.subscribeEvent<GridStopLossTriggeredEvent>(EventType.GridStopLossTriggered, (e) =>
            this.notifyUser.execute({ event: e }),
        );
        this.subscribeEvent<AgentApprovalLostEvent>(EventType.AgentApprovalLost, (e) =>
            this.notifyAgentExpired(e),
        );
    }

    private subscribeEvent<T extends SerializableEvent>(
        type: EventType,
        dispatch: (event: T) => Promise<void>,
    ): void {
        this.subscriber.subscribe<SerializableEvent>(type, async (event: SerializableEvent) => {
            const typed = this.deserializer.deserialize(event.eventType, event.serialize()) as T;
            await dispatch(typed);
        });
    }

    /**
     * Sends an agent-expired notification with a "Reconnect account" CTA button.
     * Bypasses tradeNotificationsEnabled — this is a critical account-level alert.
     */
    private async notifyAgentExpired(event: AgentApprovalLostEvent): Promise<void> {
        const user = await this.usersApi.findUserById(event.userId);
        if (!user) {
            this.logger.warn(
                { userId: event.userId },
                'User not found for AgentApprovalLost event',
            );
            return;
        }

        const message = AgentApprovalLostMessage.fromEvent(event);
        await this.botService.sendMessageWithKeyboard(user.telegramChatId, message.text, {
            inline_keyboard: [
                [
                    {
                        text: message.buttonText,
                        callback_data: TelegramAction.ConnectAccount,
                    },
                ],
            ],
        });
    }

    /**
     * Routes grid creation result to either the active wizard (edit the pending "Creating…" message)
     * or the user's chat via NotifyUserUseCase when no wizard is waiting.
     *
     * Lives in the adapter because it depends on PendingCreationMessageStore and TelegramBotService,
     * both of which are Telegram-specific infrastructure unavailable at the use-case layer.
     * The wizard path intentionally bypasses tradeNotificationsEnabled — the user is actively waiting.
     */
    private async notifyCreationResult(
        event: GridCreatedSuccessEvent | GridCreatedErrorEvent,
    ): Promise<void> {
        const pending = this.pendingCreationMessageStore.consume();
        if (pending) {
            const text = this.messageFactory.buildFromEvent(event).text;
            await this.botService.editMessage(pending.chatId, pending.messageId, text);
            return;
        }
        await this.notifyUser.execute({ event });
    }
}
