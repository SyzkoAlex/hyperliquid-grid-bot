import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Scenes, session, Telegraf } from 'telegraf';
import { Config } from '@/config/config.schema';
import { logger } from '@/infra/logger/logger';
import { BotContext } from './types/bot-context';
import { SessionData } from './types/session-data';
import { RedisSessionStore } from './redis-session-store';
import { CreateGridSceneHandler } from './scenes/create-grid/create-grid.scene';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode.enum';
import { TelegramNotificationPort } from '@components/telegram/core/application/ports/telegram-notification.port';
import { createErrorHandlerMiddleware } from './middleware/error-handler.middleware';
import { createCallbackDedupMiddleware } from './middleware/callback-dedup.middleware';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy, TelegramNotificationPort {
    private _bot: Telegraf<BotContext>;
    private readonly stage = new Scenes.Stage<BotContext>([]);
    private readonly logger = logger.child({ context: TelegramBotService.name });
    private readonly enabled: boolean;
    private readonly botToken: string;
    private readonly allowedManagerChatId: number;
    private readonly parseMode: TelegramParseMode;

    constructor(
        configService: ConfigService<Config, true>,
        private readonly sessionStore: RedisSessionStore,
    ) {
        const telegramConfig = configService.get('telegram', { infer: true });
        this.enabled = telegramConfig.enabled;
        this.botToken = telegramConfig.botToken;
        this.allowedManagerChatId = telegramConfig.allowedManagerChatId;
        this.parseMode = telegramConfig.formatting.parseMode as TelegramParseMode;
    }

    async onModuleInit() {
        if (!this.enabled) {
            this.logger.info('Telegram bot disabled');
            return;
        }

        this._bot = new Telegraf<BotContext>(this.botToken);

        // Safety net for Telegraf-level errors (polling failures, webhook errors).
        // Handler errors are caught earlier by createErrorHandlerMiddleware.
        this._bot.catch((error) => {
            this.logger.error({ error }, 'Unhandled Telegraf-level error');
        });

        // Middleware chain (order matters):
        //   session     — hydrate/persist session data
        //   auth        — reject unauthorized early, before any business logic
        //   error-handler — safety net for handler errors; wraps everything below
        //   dedup       — block duplicate button presses while a handler is running
        //   stage       — scenes and registered command/action handlers
        this._bot.use(
            session<SessionData, BotContext>({
                store: this.sessionStore,
                defaultSession: () => ({}),
            }),
        );
        this.registerAuthMiddleware();
        this._bot.use(createErrorHandlerMiddleware());
        this._bot.use(createCallbackDedupMiddleware());
        this._bot.use(this.stage.middleware());

        this.logger.info('Telegram bot service initialized');
    }

    async onModuleDestroy() {
        if (this._bot) {
            this._bot.stop();
            this.logger.info('Telegram bot stopped');
        }
    }

    get bot(): Telegraf<BotContext> {
        if (!this._bot) {
            throw new Error('Bot not initialized, skipping message send');
        }

        return this._bot;
    }

    registerScene(sceneHandler: CreateGridSceneHandler): void {
        const scene = sceneHandler.createScene();
        this.stage.register(scene);
    }

    async sendMessage(chatId: number, message: string): Promise<void> {
        try {
            await this.bot.telegram.sendMessage(chatId, message, {
                parse_mode: this.parseMode,
            });
        } catch (error) {
            if (
                error.response?.error_code === 400 &&
                error.response?.description?.includes('chat not found')
            ) {
                this.logger.warn(
                    { chatId, errorDescription: error.response.description },
                    'Cannot send message - user has not started conversation with bot yet. User must press /start first.',
                );
                return;
            }
            if (error.response?.error_code === 403) {
                this.logger.warn(
                    { chatId, errorDescription: error.response.description },
                    'Cannot send message - bot was blocked by user',
                );
                return;
            }
            throw error;
        }
    }

    getParseMode(): TelegramParseMode {
        return this.parseMode;
    }

    onCommand(command: string, handler: (ctx: BotContext) => Promise<void>): void {
        this.bot.command(command, handler);
    }

    onAction(action: string | RegExp, handler: (ctx: BotContext) => Promise<void>): void {
        this.bot.action(action, handler);
    }

    onHears(text: string | string[], handler: (ctx: BotContext) => Promise<void>): void {
        this.bot.hears(text, handler);
    }

    private registerAuthMiddleware(): void {
        this.bot.use(async (ctx: BotContext, next) => {
            const chatId = ctx.chat?.id;

            if (!chatId || chatId !== this.allowedManagerChatId) {
                this.logger.warn(
                    `Unauthorized access attempt from chatId: ${chatId}, expected: ${this.allowedManagerChatId}`,
                );
                await ctx.reply('⛔ Unauthorized access');
                return;
            }

            return next();
        });
    }

    async launch(): Promise<void> {
        await this.bot.launch();
        this.logger.info('Telegram bot launched');
    }
}
