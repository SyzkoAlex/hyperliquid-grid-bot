import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpHandler } from './help.handler';
import { TelegramBotService } from '../../telegram-bot.service';
import { BotContext } from '../../types/bot-context';
import { TelegramCommand } from '@components/telegram/core/domain/models/telegram-command';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { HelpMessage } from '@components/telegram/core/domain/models/messages/help-message';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';

describe('HelpHandler', () => {
    let handler: HelpHandler;
    let botService: TelegramBotService;
    let commandCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;
    let actionCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;
    let hearsCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;

    beforeEach(() => {
        commandCallbacks = new Map();
        actionCallbacks = new Map();
        hearsCallbacks = new Map();

        botService = {
            onCommand: vi.fn((cmd: string, cb: (ctx: BotContext) => Promise<void>) => {
                commandCallbacks.set(cmd, cb);
            }),
            onAction: vi.fn((action: string, cb: (ctx: BotContext) => Promise<void>) => {
                actionCallbacks.set(String(action), cb);
            }),
            onHears: vi.fn((text: string, cb: (ctx: BotContext) => Promise<void>) => {
                hearsCallbacks.set(text, cb);
            }),
        } as unknown as TelegramBotService;

        handler = new HelpHandler(botService);
    });

    describe('register', () => {
        it('should register /help command, action, and hears', () => {
            handler.register();

            expect(botService.onCommand).toHaveBeenCalledWith(
                TelegramCommand.Help,
                expect.any(Function),
            );
            expect(botService.onAction).toHaveBeenCalledWith(
                TelegramAction.ShowHelp,
                expect.any(Function),
            );
            expect(botService.onHears).toHaveBeenCalledWith(
                BUTTON_LABELS.HELP,
                expect.any(Function),
            );
        });
    });

    describe('handle (command / hears)', () => {
        it('should reply with help message on /help command', async () => {
            handler.register();
            const ctx = createMockContext();

            await commandCallbacks.get(TelegramCommand.Help)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(HelpMessage.create().text, {
                parse_mode: TelegramParseMode.HTML,
            });
        });

        it('should reply with help message on Help button', async () => {
            handler.register();
            const ctx = createMockContext();

            await hearsCallbacks.get(BUTTON_LABELS.HELP)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(HelpMessage.create().text, {
                parse_mode: TelegramParseMode.HTML,
            });
        });
    });

    describe('handleAction', () => {
        it('should answer callback and edit message with help text', async () => {
            handler.register();
            const ctx = createMockContext();

            await actionCallbacks.get(TelegramAction.ShowHelp)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(ctx.editMessageText).toHaveBeenCalledWith(HelpMessage.create().text, {
                parse_mode: TelegramParseMode.HTML,
            });
        });
    });

    function createMockContext(): BotContext {
        return {
            reply: vi.fn(),
            answerCbQuery: vi.fn(),
            editMessageText: vi.fn(),
        } as unknown as BotContext;
    }
});
