import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TelegramCommandsAdapter } from './telegram-commands.adapter';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { BotContext } from '../telegram-bot/types/bot-context';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { UserStatus } from '@domain/models/user/user-status';
import { CREATE_GRID_SCENE_ID } from '../telegram-bot/scenes/create-grid/create-grid.scene';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { CommonTexts } from '@components/telegram/core/domain/models/messages/common.texts';
import { ConfigService } from '@nestjs/config';
import { ManagedLockService } from '@/core/application/services/managed-lock/managed-lock.service';

function makeBotService() {
    const actionCallbacks = new Map<string, (ctx: BotContext) => Promise<void>>();
    const hearsCallbacks = new Map<string, (ctx: BotContext) => Promise<void>>();
    return {
        actionCallbacks,
        hearsCallbacks,
        service: {
            onAction: vi.fn((action: string, cb: (ctx: BotContext) => Promise<void>) => {
                actionCallbacks.set(String(action), cb);
            }),
            onHears: vi.fn((text: string, cb: (ctx: BotContext) => Promise<void>) => {
                hearsCallbacks.set(text, cb);
            }),
            onCommand: vi.fn(),
            registerScene: vi.fn(),
            launch: vi.fn().mockResolvedValue(undefined),
            stop: vi.fn(),
        } as unknown as TelegramBotService,
    };
}

function makeHandler() {
    return { register: vi.fn() } as { register: ReturnType<typeof vi.fn> };
}

function makeManagedLock() {
    return {
        hold: vi.fn().mockReturnValue({ dispose: vi.fn().mockResolvedValue(undefined) }),
    } as unknown as ManagedLockService;
}

function makeConfigService() {
    return {
        get: vi.fn().mockReturnValue({ botLockTtlMs: 5000 }),
    } as unknown as ConfigService;
}

describe('TelegramCommandsAdapter — routeCreateGrid', () => {
    let adapter: TelegramCommandsAdapter;
    let actionCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;
    let hearsCallbacks: Map<string, (ctx: BotContext) => Promise<void>>;

    beforeEach(async () => {
        const bot = makeBotService();
        actionCallbacks = bot.actionCallbacks;
        hearsCallbacks = bot.hearsCallbacks;

        adapter = new TelegramCommandsAdapter(
            bot.service,
            makeHandler() as never,
            makeHandler() as never,
            makeHandler() as never,
            makeHandler() as never,
            makeHandler() as never,
            makeHandler() as never,
            makeHandler() as never,
            makeHandler() as never,
            makeHandler() as never,
            makeHandler() as never,
            { getScene: vi.fn() } as never,
            { getScene: vi.fn() } as never,
            makeManagedLock(),
            makeConfigService() as never,
        );

        // Trigger handler registration via onModuleInit (bypasses managed lock by calling startBot directly)
        await (adapter as unknown as { startBot: () => Promise<void> }).startBot();
    });

    describe('CreateGrid action', () => {
        it('should reply with connect CTA when user is not Active', async () => {
            const ctx = {
                answerCbQuery: vi.fn().mockResolvedValue(undefined),
                reply: vi.fn().mockResolvedValue(undefined),
                scene: { enter: vi.fn() },
                user: undefined,
            } as unknown as BotContext;

            await actionCallbacks.get(TelegramAction.CreateGrid)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
            expect(ctx.scene.enter).not.toHaveBeenCalled();
        });

        it('should enter create-grid scene when user is Active', async () => {
            const ctx = {
                answerCbQuery: vi.fn().mockResolvedValue(undefined),
                reply: vi.fn(),
                scene: { enter: vi.fn().mockResolvedValue(undefined) },
                user: { status: UserStatus.Active, accountAddress: '0xabc' },
            } as unknown as BotContext;

            await actionCallbacks.get(TelegramAction.CreateGrid)!(ctx);

            expect(ctx.scene.enter).toHaveBeenCalledWith(CREATE_GRID_SCENE_ID);
            expect(ctx.reply).not.toHaveBeenCalled();
        });
    });

    describe('Settings action', () => {
        it('should reply with connect CTA when user is not Active', async () => {
            const ctx = {
                answerCbQuery: vi.fn().mockResolvedValue(undefined),
                reply: vi.fn().mockResolvedValue(undefined),
                editMessageText: vi.fn(),
                user: undefined,
            } as unknown as BotContext;

            await actionCallbacks.get(TelegramAction.ShowSettings)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
            expect(ctx.editMessageText).not.toHaveBeenCalled();
        });

        it('should edit message with coming-soon text when user is Active', async () => {
            const ctx = {
                answerCbQuery: vi.fn().mockResolvedValue(undefined),
                reply: vi.fn(),
                editMessageText: vi.fn().mockResolvedValue(undefined),
                user: { status: UserStatus.Active, accountAddress: '0xabc' },
            } as unknown as BotContext;

            await actionCallbacks.get(TelegramAction.ShowSettings)!(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(ctx.editMessageText).toHaveBeenCalledWith(CommonTexts.COMING_SOON);
            expect(ctx.reply).not.toHaveBeenCalled();
        });
    });

    describe('Settings hears', () => {
        it('should reply with connect CTA when user is not Active', async () => {
            const ctx = {
                reply: vi.fn().mockResolvedValue(undefined),
                editMessageText: vi.fn(),
                user: undefined,
            } as unknown as BotContext;

            await hearsCallbacks.get(BUTTON_LABELS.SETTINGS)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
            expect(ctx.editMessageText).not.toHaveBeenCalled();
        });

        it('should reply with coming-soon text when user is Active', async () => {
            const ctx = {
                reply: vi.fn().mockResolvedValue(undefined),
                editMessageText: vi.fn(),
                user: { status: UserStatus.Active, accountAddress: '0xabc' },
            } as unknown as BotContext;

            await hearsCallbacks.get(BUTTON_LABELS.SETTINGS)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(CommonTexts.COMING_SOON);
            expect(ctx.editMessageText).not.toHaveBeenCalled();
        });
    });

    describe('Create Grid hears', () => {
        it('should reply with connect CTA when user is not Active', async () => {
            const ctx = {
                reply: vi.fn().mockResolvedValue(undefined),
                scene: { enter: vi.fn() },
                user: undefined,
            } as unknown as BotContext;

            await hearsCallbacks.get(BUTTON_LABELS.CREATE_GRID)!(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ parse_mode: TelegramParseMode.HTML }),
            );
            expect(ctx.scene.enter).not.toHaveBeenCalled();
        });

        it('should enter create-grid scene when user is Active', async () => {
            const ctx = {
                reply: vi.fn(),
                scene: { enter: vi.fn().mockResolvedValue(undefined) },
                user: { status: UserStatus.Active, accountAddress: '0xabc' },
            } as unknown as BotContext;

            await hearsCallbacks.get(BUTTON_LABELS.CREATE_GRID)!(ctx);

            expect(ctx.scene.enter).toHaveBeenCalledWith(CREATE_GRID_SCENE_ID);
            expect(ctx.reply).not.toHaveBeenCalled();
        });
    });
});
