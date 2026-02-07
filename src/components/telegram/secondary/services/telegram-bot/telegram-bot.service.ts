import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Scenes, session } from 'telegraf';
import { Config } from '@infra/config/config.schema';
import { logger } from '@infra/logger/logger';
import { BotContext } from './types/bot-context';
import { SessionData } from './types/session-data';
import { RedisSessionStore } from './redis-session-store';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
    private bot: Telegraf<BotContext>;
    private readonly stage = new Scenes.Stage<BotContext>([]);
    private readonly logger = logger.child({ context: TelegramBotService.name });
    private readonly enabled: boolean;
    private readonly botToken: string;

    constructor(
        configService: ConfigService<Config, true>,
        private readonly sessionStore: RedisSessionStore,
    ) {
        const telegramConfig = configService.get('telegram', { infer: true });
        this.enabled = telegramConfig.enabled;
        this.botToken = telegramConfig.botToken;
    }

    async onModuleInit() {
        if (!this.enabled) {
            this.logger.info('Telegram bot disabled');
            return;
        }

        this.bot = new Telegraf<BotContext>(this.botToken);

        this.bot.use(
            session<SessionData, BotContext>({
                store: this.sessionStore,
                defaultSession: () => ({}),
            }),
        );
        this.bot.use(this.stage.middleware());

        this.logger.info('Telegram bot service initialized');
    }

    async onModuleDestroy() {
        if (this.bot) {
            this.bot.stop();
            this.logger.info('Telegram bot stopped');
        }
    }

    registerScene(scene: Scenes.BaseScene<BotContext>): void {
        this.stage.register(scene);
    }

    getBot(): Telegraf<BotContext> {
        return this.bot;
    }

    async sendMessage(chatId: number, message: string): Promise<void> {
        if (!this.bot) {
            this.logger.warn('Bot not initialized, skipping message send');
            return;
        }

        try {
            await this.bot.telegram.sendMessage(chatId, message, {
                parse_mode: 'HTML',
            });
        } catch (error) {
            this.logger.error({ error, chatId }, 'Failed to send message');
        }
    }

    onCommand(command: string, handler: (ctx: BotContext) => Promise<void>): void {
        if (this.bot) {
            this.bot.command(command, handler);
        }
    }

    onAction(action: string, handler: (ctx: BotContext) => Promise<void>): void {
        if (this.bot) {
            this.bot.action(action, handler);
        }
    }

    useMiddleware(middleware: (ctx: BotContext, next: () => Promise<void>) => Promise<void>): void {
        if (this.bot) {
            this.bot.use(middleware);
        }
    }

    async launch(): Promise<void> {
        if (this.bot) {
            await this.bot.launch();
            this.logger.info('Telegram bot launched');
        }
    }
}
