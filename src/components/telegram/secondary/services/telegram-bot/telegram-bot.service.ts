import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, Telegraf } from 'telegraf';
import { logger } from '@infra/logger/logger';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
    private bot: Telegraf;
    private readonly logger = logger.child({ context: TelegramBotService.name });

    constructor(private readonly configService: ConfigService) {}

    async onModuleInit() {
        const enabled = this.configService.get<boolean>('TELEGRAM_ENABLED', true);

        if (!enabled) {
            this.logger.info('Telegram bot disabled');
            return;
        }

        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

        if (!token) {
            this.logger.warn('TELEGRAM_BOT_TOKEN not configured');
            return;
        }

        this.bot = new Telegraf(token);
        this.logger.info('Telegram bot service initialized');
    }

    async onModuleDestroy() {
        if (this.bot) {
            this.bot.stop();
            this.logger.info('Telegram bot stopped');
        }
    }

    getBot(): Telegraf {
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

    onCommand(command: string, handler: (ctx: Context) => Promise<void>): void {
        if (this.bot) {
            this.bot.command(command, handler);
        }
    }

    onAction(action: string, handler: (ctx: Context) => Promise<void>): void {
        if (this.bot) {
            this.bot.action(action, handler);
        }
    }

    useMiddleware(middleware: (ctx: Context, next: () => Promise<void>) => Promise<void>): void {
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
