import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@infra/config/config.schema';
import { logger } from '@infra/logger/logger';
import { TelegramBotService } from '../../secondary/services/telegram-bot/telegram-bot.service';
import { BotContext } from '../../secondary/services/telegram-bot/types/bot-context';

@Injectable()
export class TelegramCommandsController implements OnModuleInit {
    private readonly logger = logger.child({ context: TelegramCommandsController.name });
    private readonly notificationChatId: number;

    constructor(
        configService: ConfigService<Config, true>,
        private readonly telegramBot: TelegramBotService,
    ) {
        this.notificationChatId = configService.get('telegram', { infer: true }).notificationChatId;
    }

    async onModuleInit() {
        this.registerMiddleware();
        await this.telegramBot.launch();
        this.logger.info('Telegram bot controller initialized');
    }

    private registerMiddleware() {
        this.telegramBot.useMiddleware(async (ctx: BotContext, next) => {
            const chatId = ctx.chat?.id;

            if (!chatId || chatId !== this.notificationChatId) {
                await ctx.reply('⛔ Unauthorized access');
                return;
            }

            return next();
        });
    }
}
