import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Scenes, session, Telegraf } from 'telegraf';
import { Config } from '@infra/config/config.schema';
import { logger } from '@infra/logger/logger';
import { BotContext } from './types/bot-context';
import { SessionData } from './types/session-data';
import { RedisSessionStore } from './redis-session-store';
import { CreateGridSceneHandler } from './scenes/create-grid/create-grid.scene';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
    private _bot: Telegraf<BotContext>;
    private readonly stage = new Scenes.Stage<BotContext>([]);
    private readonly logger = logger.child({ context: TelegramBotService.name });
    private readonly enabled: boolean;
    private readonly botToken: string;
    private readonly notificationChatId: number;

    constructor(
        configService: ConfigService<Config, true>,
        private readonly sessionStore: RedisSessionStore,
    ) {
        const telegramConfig = configService.get('telegram', { infer: true });
        this.enabled = telegramConfig.enabled;
        this.botToken = telegramConfig.botToken;
        this.notificationChatId = telegramConfig.notificationChatId;
    }

    async onModuleInit() {
        if (!this.enabled) {
            this.logger.info('Telegram bot disabled');
            return;
        }

        this._bot = new Telegraf<BotContext>(this.botToken);

        this._bot.use(
            session<SessionData, BotContext>({
                store: this.sessionStore,
                defaultSession: () => ({}),
            }),
        );
        this._bot.use(this.stage.middleware());
        this.registerAuthMiddleware();

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
        await this.bot.telegram.sendMessage(chatId, message, {
            parse_mode: 'HTML',
        });
    }

    onCommand(command: string, handler: (ctx: BotContext) => Promise<void>): void {
        this.bot.command(command, handler);
    }

    onAction(action: string, handler: (ctx: BotContext) => Promise<void>): void {
        this.bot.action(action, handler);
    }

    private registerAuthMiddleware(): void {
        this.bot.use(async (ctx: BotContext, next) => {
            const chatId = ctx.chat?.id;

            if (!chatId || chatId !== this.notificationChatId) {
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
