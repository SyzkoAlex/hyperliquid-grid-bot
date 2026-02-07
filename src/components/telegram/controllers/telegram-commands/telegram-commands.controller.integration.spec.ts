import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MessageContext } from '../../core/domain/message-context';
import { COMMAND_REGISTRAR, CommandRegistrar } from '../../core/services/command-registrar.service';
import { TelegramCommandsController } from './telegram-commands.controller';
import { StartHandler } from './handlers/start/start.handler';
import { HelpHandler } from './handlers/help/help.handler';
import { MainMenuHandler } from './handlers/main-menu/main-menu.handler';
import { TelegramCommand, TelegramAction } from '../../core/domain/telegram-command.enum';
import { WelcomeMessage } from '../../core/domain/messages/welcome-message';
import { HelpMessage } from '../../core/domain/messages/help-message';
import { mainMenuKeyboard, backToMenuKeyboard } from './handlers/main-menu.keyboard';

type HandlerFn = (ctx: MessageContext) => Promise<void>;

describe('TelegramCommandsController (Integration)', () => {
    let controller: TelegramCommandsController;
    let registeredCommands: Map<string, HandlerFn>;
    let registeredActions: Map<string, HandlerFn>;
    let mockRegistrar: CommandRegistrar;

    beforeEach(async () => {
        registeredCommands = new Map();
        registeredActions = new Map();

        mockRegistrar = {
            onCommand: vi.fn((cmd: string, handler: HandlerFn) => {
                registeredCommands.set(cmd, handler);
            }),
            onAction: vi.fn((action: string, handler: HandlerFn) => {
                registeredActions.set(action, handler);
            }),
            launch: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                { provide: COMMAND_REGISTRAR, useValue: mockRegistrar },
                StartHandler,
                HelpHandler,
                MainMenuHandler,
                TelegramCommandsController,
            ],
        }).compile();

        controller = module.get(TelegramCommandsController);
        await controller.onModuleInit();
    });

    function createMockContext(): MessageContext {
        return {
            chatId: 123,
            reply: vi.fn(),
            editMessage: vi.fn(),
            answerCallback: vi.fn(),
        };
    }

    describe('Handler Registration', () => {
        it('should register /start and /help commands', () => {
            expect(registeredCommands.has(TelegramCommand.Start)).toBe(true);
            expect(registeredCommands.has(TelegramCommand.Help)).toBe(true);
        });

        it('should register main:menu and show:help actions', () => {
            expect(registeredActions.has(TelegramAction.MainMenu)).toBe(true);
            expect(registeredActions.has(TelegramAction.ShowHelp)).toBe(true);
        });

        it('should call launch', () => {
            expect(mockRegistrar.launch).toHaveBeenCalled();
        });
    });

    describe('/start command', () => {
        it('should reply with welcome message and main menu keyboard', async () => {
            const ctx = createMockContext();
            await registeredCommands.get(TelegramCommand.Start)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                new WelcomeMessage().toString(),
                mainMenuKeyboard(),
            );
        });
    });

    describe('/help command', () => {
        it('should reply with help message and back button', async () => {
            const ctx = createMockContext();
            await registeredCommands.get(TelegramCommand.Help)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                new HelpMessage().toString(),
                backToMenuKeyboard(),
            );
        });
    });

    describe('show:help action', () => {
        it('should answer callback and edit message with help text', async () => {
            const ctx = createMockContext();
            await registeredActions.get(TelegramAction.ShowHelp)!(ctx);

            expect(ctx.answerCallback).toHaveBeenCalled();
            expect(ctx.editMessage).toHaveBeenCalledWith(
                new HelpMessage().toString(),
                backToMenuKeyboard(),
            );
        });
    });

    describe('main:menu action', () => {
        it('should answer callback and edit message with welcome text and menu', async () => {
            const ctx = createMockContext();
            await registeredActions.get(TelegramAction.MainMenu)!(ctx);

            expect(ctx.answerCallback).toHaveBeenCalled();
            expect(ctx.editMessage).toHaveBeenCalledWith(
                new WelcomeMessage().toString(),
                mainMenuKeyboard(),
            );
        });
    });
});
