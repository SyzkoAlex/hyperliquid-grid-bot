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
import { AgentApprovalLostEvent } from '@domain/models/events/trading/agent-approval-lost.event';
import { AgentApprovalLostMessage } from '@components/telegram/core/domain/models/messages/notifications/agent-approval-lost-message';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { UserDto } from '@components/users/api/dto/user.dto';
import { UserStatus } from '@domain/models/user/user-status';

const USER_ID = 'user-1';
const CHAT_ID = 12345;

function makeUserDto(overrides: Partial<UserDto> = {}): UserDto {
    return {
        id: USER_ID,
        telegramChatId: CHAT_ID,
        accountAddress: '0xabc',
        agentAddress: '0xagent',
        status: UserStatus.Active,
        timezone: 'UTC',
        tradeNotificationsEnabled: true,
        ...overrides,
    };
}

function buildAdapter(
    subscriberCallbacks: Map<EventType, (event: SerializableEvent) => Promise<void>>,
    overrides: {
        notifyUser?: { execute: ReturnType<typeof vi.fn> };
        messageFactory?: { buildFromEvent: ReturnType<typeof vi.fn> };
        botService?: Partial<{
            editMessage: ReturnType<typeof vi.fn>;
            sendMessageWithKeyboard: ReturnType<typeof vi.fn>;
        }>;
        pendingStore?: { consume: ReturnType<typeof vi.fn> };
        usersApi?: { findUserById: ReturnType<typeof vi.fn> };
    } = {},
): TradingEventsAdapter {
    const subscriber = {
        subscribe: vi.fn((type: EventType, handler: (e: SerializableEvent) => Promise<void>) => {
            subscriberCallbacks.set(type, handler);
            return () => {};
        }),
    };
    const notifyUser = overrides.notifyUser ?? { execute: vi.fn().mockResolvedValue(undefined) };
    const messageFactory = overrides.messageFactory ?? {
        buildFromEvent: vi.fn().mockReturnValue({ text: 'result text' }),
    };
    const botService = {
        editMessage: vi.fn().mockResolvedValue(undefined),
        sendMessageWithKeyboard: vi.fn().mockResolvedValue(undefined),
        ...overrides.botService,
    };
    const pendingStore = overrides.pendingStore ?? { consume: vi.fn().mockReturnValue(null) };
    const usersApi = overrides.usersApi ?? { findUserById: vi.fn().mockResolvedValue(null) };

    const adapter = new TradingEventsAdapter(
        subscriber as unknown as EventSubscriberPort,
        new EventDeserializer(),
        notifyUser as unknown as NotifyUserUseCase,
        messageFactory as unknown as NotificationMessageFactory,
        botService as unknown as TelegramBotService,
        pendingStore as unknown as PendingCreationMessageStore,
        usersApi as any,
    );
    adapter.onModuleInit();
    return adapter;
}

describe('TradingEventsAdapter — notifyCreationResult', () => {
    let subscriberCallbacks: Map<EventType, (event: SerializableEvent) => Promise<void>>;
    let notifyUser: { execute: ReturnType<typeof vi.fn> };
    let messageFactory: { buildFromEvent: ReturnType<typeof vi.fn> };
    let botService: { editMessage: ReturnType<typeof vi.fn> };
    let pendingStore: { consume: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        subscriberCallbacks = new Map();
        notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
        messageFactory = { buildFromEvent: vi.fn().mockReturnValue({ text: 'result text' }) };
        botService = { editMessage: vi.fn().mockResolvedValue(undefined) };
        pendingStore = { consume: vi.fn().mockReturnValue(null) };

        buildAdapter(subscriberCallbacks, { notifyUser, messageFactory, botService, pendingStore });
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

describe('TradingEventsAdapter — notifyAgentExpired', () => {
    let subscriberCallbacks: Map<EventType, (event: SerializableEvent) => Promise<void>>;
    let sendMessageWithKeyboard: ReturnType<typeof vi.fn>;
    let findUserById: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        subscriberCallbacks = new Map();
        sendMessageWithKeyboard = vi.fn().mockResolvedValue(undefined);
        findUserById = vi.fn().mockResolvedValue(null);

        buildAdapter(subscriberCallbacks, {
            botService: { sendMessageWithKeyboard },
            usersApi: { findUserById },
        });
    });

    it('logs a warning and skips sending when user is not found', async () => {
        findUserById.mockResolvedValue(null);
        const event = new AgentApprovalLostEvent(USER_ID);

        await subscriberCallbacks.get(EventType.AgentApprovalLost)!(event);

        expect(sendMessageWithKeyboard).not.toHaveBeenCalled();
    });

    it('calls sendMessageWithKeyboard with correct chatId, text, and ConnectAccount button', async () => {
        findUserById.mockResolvedValue(makeUserDto());
        const event = new AgentApprovalLostEvent(USER_ID);
        const expectedMessage = AgentApprovalLostMessage.fromEvent(event);

        await subscriberCallbacks.get(EventType.AgentApprovalLost)!(event);

        expect(sendMessageWithKeyboard).toHaveBeenCalledOnce();
        const [chatId, text, replyMarkup] = sendMessageWithKeyboard.mock.calls[0];
        expect(chatId).toBe(CHAT_ID);
        expect(text).toBe(expectedMessage.text);
        expect(replyMarkup).toEqual({
            inline_keyboard: [
                [
                    {
                        text: expectedMessage.buttonText,
                        callback_data: TelegramAction.ConnectAccount,
                    },
                ],
            ],
        });
    });
});
