import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TradingEventsAdapter } from './trading-events.adapter';
import { EventDeserializer } from '@domain/models/events/event-deserializer';
import { EventSubscriberPort } from '@/core/application/ports/inbound/event-subscriber.port';
import { NotifyUserUseCase } from '@components/telegram/core/application/use-cases/notify-user/notify-user.use-case';
import { NotificationMessageFactory } from '@components/telegram/core/domain/models/messages/notifications/notification-message.factory';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { PendingCreationMessageStore } from '../telegram-bot/pending-creation-message.store';
import { SerializableEvent } from '@domain/models/events/trading/trading-event';
import { EventType } from '@domain/models/events/event-type';
import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';

const USER_ID = 'user-1';

describe('TradingEventsAdapter — notifyCreationResult', () => {
    let subscriberCallbacks: Map<EventType, (event: SerializableEvent) => Promise<void>>;
    let notifyUser: { execute: ReturnType<typeof vi.fn> };
    let messageFactory: { buildFromEvent: ReturnType<typeof vi.fn> };
    let botService: { editMessage: ReturnType<typeof vi.fn> };
    let pendingStore: { consume: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        subscriberCallbacks = new Map();
        const subscriber = {
            subscribe: vi.fn(
                (type: EventType, handler: (e: SerializableEvent) => Promise<void>) => {
                    subscriberCallbacks.set(type, handler);
                    return () => {};
                },
            ),
        };
        notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
        messageFactory = { buildFromEvent: vi.fn().mockReturnValue({ text: 'result text' }) };
        botService = { editMessage: vi.fn().mockResolvedValue(undefined) };
        pendingStore = { consume: vi.fn().mockReturnValue(null) };

        const mockUsersApi = { findUserById: vi.fn().mockResolvedValue(null) };
        const adapter = new TradingEventsAdapter(
            subscriber as unknown as EventSubscriberPort,
            new EventDeserializer(),
            notifyUser as unknown as NotifyUserUseCase,
            messageFactory as unknown as NotificationMessageFactory,
            botService as unknown as TelegramBotService,
            pendingStore as unknown as PendingCreationMessageStore,
            mockUsersApi as any,
        );
        adapter.onModuleInit();
    });

    describe('when a pending wizard message exists', () => {
        beforeEach(() => {
            pendingStore.consume.mockReturnValue({ chatId: 111, messageId: 222 });
        });

        it('edits the pending message for GridCreatedSuccess', async () => {
            const event = new GridCreatedSuccessEvent(
                USER_ID,
                'grid-1',
                'BTC',
                50000,
                60000,
                10,
                5000,
                0.5,
                false,
            );

            await subscriberCallbacks.get(EventType.GridCreatedSuccess)!(event);

            expect(botService.editMessage).toHaveBeenCalledWith(111, 222, 'result text');
            expect(notifyUser.execute).not.toHaveBeenCalled();
        });

        it('edits the pending message for GridCreatedError', async () => {
            const event = new GridCreatedErrorEvent(USER_ID, 'Something went wrong');

            await subscriberCallbacks.get(EventType.GridCreatedError)!(event);

            expect(botService.editMessage).toHaveBeenCalledWith(111, 222, 'result text');
            expect(notifyUser.execute).not.toHaveBeenCalled();
        });
    });

    describe('when no pending wizard message', () => {
        it('falls back to NotifyUserUseCase for GridCreatedSuccess', async () => {
            const event = new GridCreatedSuccessEvent(
                USER_ID,
                'grid-1',
                'BTC',
                50000,
                60000,
                10,
                5000,
                0.5,
                false,
            );

            await subscriberCallbacks.get(EventType.GridCreatedSuccess)!(event);

            expect(notifyUser.execute).toHaveBeenCalledWith({
                event: expect.any(GridCreatedSuccessEvent),
            });
            expect(botService.editMessage).not.toHaveBeenCalled();
        });

        it('falls back to NotifyUserUseCase for GridCreatedError', async () => {
            const event = new GridCreatedErrorEvent(USER_ID, 'Something went wrong');

            await subscriberCallbacks.get(EventType.GridCreatedError)!(event);

            expect(notifyUser.execute).toHaveBeenCalledWith({
                event: expect.any(GridCreatedErrorEvent),
            });
            expect(botService.editMessage).not.toHaveBeenCalled();
        });
    });
});
