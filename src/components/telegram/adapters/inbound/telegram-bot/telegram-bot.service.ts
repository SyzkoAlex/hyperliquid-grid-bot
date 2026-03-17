import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Scenes, Telegraf } from 'telegraf';
import { Config } from '@/config/config.schema';
import { logger } from '@/infra/logger/logger';
import { BotContext } from './types/bot-context';
import { CacheSessionStore } from './cache-session-store';
import { SceneHandler } from './scenes/scene-handler';
import { TelegramNotificationPort } from '@components/telegram/core/application/ports/telegram-notification.port';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { createErrorHandlerMiddleware } from './middleware/error-handler.middleware';
import { createCallbackDedupMiddleware } from './middleware/callback-dedup.middleware';
import { createSessionMiddleware } from './middleware/session.middleware';
import { createAuthMiddleware } from './middleware/auth.middleware';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy, TelegramNotificationPort {
    private _bot: Telegraf<BotContext>;
    private readonly stage = new Scenes.Stage<BotContext>([]);
    private readonly logger = logger.child({ context: TelegramBotService.name });
    private readonly enabled: boolean;
    private readonly botToken: string;
    private readonly allowedManagerChatId: number;

    constructor(
        configService: ConfigService<Config, true>,
        private readonly sessionStore: CacheSessionStore,
    ) {
        const telegramConfig = configService.get('telegram', { infer: true });
        this.enabled = telegramConfig.enabled;
        this.botToken = telegramConfig.botToken;
        this.allowedManagerChatId = telegramConfig.allowedManagerChatId;
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
        this._bot.use(createSessionMiddleware(this.sessionStore));
        this._bot.use(createAuthMiddleware(this.allowedManagerChatId));
        this._bot.use(createErrorHandlerMiddleware());
        this._bot.use(createCallbackDedupMiddleware());
        this._bot.use(this.stage.middleware());

        this.logger.info('Telegram bot service initialized');
    }

    async onModuleDestroy() {
        this.stop();
    }

    get bot(): Telegraf<BotContext> {
        if (!this._bot) {
            throw new Error('Bot not initialized, skipping message send');
        }

        return this._bot;
    }

    registerScene(sceneHandler: SceneHandler): void {
        const scene = sceneHandler.createScene();
        this.stage.register(scene);
    }

    async sendMessage(chatId: number, message: string): Promise<void> {
        try {
            await this.bot.telegram.sendMessage(chatId, message, {
                parse_mode: TelegramParseMode.HTML,
            });
        } catch (error) {
            if (this.isIgnorableError(error)) return;
            throw error;
        }
    }

    async editMessage(chatId: number, messageId: number, message: string): Promise<void> {
        try {
            await this.bot.telegram.editMessageText(chatId, messageId, undefined, message, {
                parse_mode: TelegramParseMode.HTML,
            });
        } catch (error) {
            if (this.isIgnorableError(error)) return;
            throw error;
        }
    }

    private isIgnorableError(error: {
        response?: { error_code?: number; description?: string };
    }): boolean {
        if (
            error.response?.error_code === 400 &&
            error.response?.description?.includes('chat not found')
        ) {
            this.logger.warn(
                { errorDescription: error.response.description },
                'Cannot send message - user has not started conversation with bot yet. User must press /start first.',
            );
            return true;
        }
        if (error.response?.error_code === 403) {
            this.logger.warn(
                { errorDescription: error.response.description },
                'Cannot send message - bot was blocked by user',
            );
            return true;
        }
        return false;
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

    async launch(): Promise<void> {
        await this.bot.launch();
        this.logger.info('Telegram bot launched');
    }

    stop(): void {
        if (this._bot) {
            this._bot.stop();
            this.logger.info('Telegram bot stopped');
        }
    }
}
