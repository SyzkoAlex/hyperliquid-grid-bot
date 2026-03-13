import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StartHandler } from './start.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { WelcomeMessage } from '@components/telegram/core/domain/models/messages/welcome-message';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';

describe('StartHandler', () => {
    let handler: StartHandler;
    let botService: TelegramBotService;
    let registeredCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;

    beforeEach(() => {
        registeredCallbacks = new Map();

        botService = {
            onCommand: vi.fn((cmd: string, cb: (ctx: BotContext) => Promise<void>) => {
                registeredCallbacks.set(`cmd:${cmd}`, cb);
            }),
        } as unknown as TelegramBotService;

        handler = new StartHandler(botService);
    });

    describe('register', () => {
        it('should register /start command', () => {
            handler.register();

            expect(botService.onCommand).toHaveBeenCalledWith(
                TelegramCommand.Start,
                expect.any(Function),
            );
        });
    });

    describe('handle', () => {
        it('should reply with welcome message and menu keyboard', async () => {
            handler.register();
            const ctx = createMockContext();

            await registeredCallbacks.get(`cmd:${TelegramCommand.Start}`)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                WelcomeMessage.create().text,
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
        });
    });

    function createMockContext(): BotContext {
        return {
            reply: vi.fn(),
        } as unknown as BotContext;
    }
});
