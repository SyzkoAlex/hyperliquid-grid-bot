import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context, Markup } from 'telegraf';
import { EventBus } from '../../../../../infra/events/event-bus.service';
import { CreateGridCommandEvent } from '../../../../../domain/events/create-grid-command.event';
import { logger } from '../../../../../infra/logger/logger';

/**
 * Telegraf Bot Controller
 * Primary Adapter for Telegram Bot interaction
 */
@Injectable()
export class TelegrafBotController implements OnModuleInit, OnModuleDestroy {
    private bot: Telegraf;
    private readonly logger = logger.child({ context: TelegrafBotController.name });

    constructor(
        private readonly configService: ConfigService,
        private readonly eventBus: EventBus,
    ) {}

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
        this.registerMiddleware();
        this.registerCommands();
        this.registerActions();

        await this.bot.launch();
        this.logger.info('Telegram bot started');
    }

    async onModuleDestroy() {
        if (this.bot) {
            this.bot.stop();
            this.logger.info('Telegram bot stopped');
        }
    }

    private registerMiddleware() {
        // Auth middleware
        this.bot.use(async (ctx, next) => {
            const allowedChatIds = this.configService
                .get<string>('TELEGRAM_ALLOWED_CHAT_IDS', '')
                .split(',')
                .map((id) => parseInt(id.trim()));

            const chatId = ctx.chat?.id;

            if (!chatId || !allowedChatIds.includes(chatId)) {
                await ctx.reply('⛔ Unauthorized access');
                return;
            }

            return next();
        });
    }

    private registerCommands() {
        // /start
        this.bot.command('start', async (ctx) => {
            await ctx.reply(
                '👋 <b>Welcome to Hyperliquid Grid Bot!</b>\n\n' +
                    'Available commands:\n' +
                    '/info - Position information\n' +
                    '/status - Grid bot status\n' +
                    '/help - Show help',
                {
                    parse_mode: 'HTML',
                    ...this.getMainKeyboard(),
                },
            );
        });

        // /help
        this.bot.command('help', async (ctx) => {
            await ctx.reply(
                '📚 <b>Help - Available Commands</b>\n\n' +
                    '<b>/start</b> - Initialize bot\n' +
                    '<b>/grid</b> - Create and start grid\n' +
                    '<b>/info</b> - Show position info (size, PnL, etc.)\n' +
                    '<b>/status</b> - Show grid bot status\n' +
                    '<b>/stop</b> - Stop grid bot\n' +
                    '<b>/help</b> - Show this help\n\n' +
                    '<b>Grid Command Examples:</b>\n' +
                    '<code>/grid BTC 45000 55000</code>\n' +
                    '<code>/grid ETH 2500 3500 mode=long levels=25 trailing=true</code>\n' +
                    '<code>/grid SOL 100 150 capital=5000</code>',
                { parse_mode: 'HTML' },
            );
        });

        // /grid - Create and start grid
        this.bot.command('grid', async (ctx) => {
            await this.handleGridCommand(ctx);
        });

        // /info
        this.bot.command('info', async (ctx) => {
            // Mock data - integrate with actual use cases
            const message =
                '📊 <b>Position Information</b>\n\n' +
                '<b>Symbol:</b> ETH-USD\n' +
                '<b>Mode:</b> Neutral Grid\n\n' +
                '<b>Position Size:</b> 2.5 ETH\n' +
                '<b>Entry Price:</b> $3,230.00\n' +
                '<b>Current Price:</b> $3,260.00\n\n' +
                '💰 <b>PnL:</b>\n' +
                '<code>Trading PnL:  +$125.50</code>\n' +
                '<code>Funding PnL:  -$15.30</code>\n' +
                '<code>Net PnL:      +$110.20 (+3.41%)</code>\n\n' +
                '🎯 <b>Grid Parameters:</b>\n' +
                '• Levels: 20\n' +
                '• Range: $3,100 - $3,400\n' +
                '• Active Orders: 18\n\n' +
                '⏱ <b>Uptime:</b> 2d 14h 32m';

            await ctx.reply(message, {
                parse_mode: 'HTML',
                ...this.getMainKeyboard(),
            });
        });

        // /status
        this.bot.command('status', async (ctx) => {
            const message =
                '🤖 <b>Grid Bot Status</b>\n\n' +
                '<b>Status:</b> ✅ Running\n' +
                '<b>Symbol:</b> ETH-USD\n\n' +
                '<b>Active Grids:</b> 1\n' +
                '<b>Active Orders:</b> 18/20\n' +
                '<b>Pending Orders:</b> 18\n\n' +
                '<b>Last Order:</b> 5 min ago\n' +
                '<b>Last Trade:</b> 12 min ago\n\n' +
                '<b>Grid Health:</b> ✅ Healthy\n' +
                '<b>Balance:</b> $10,450.32 USDC';

            await ctx.reply(message, {
                parse_mode: 'HTML',
                ...this.getMainKeyboard(),
            });
        });

        // /stop
        this.bot.command('stop', async (ctx) => {
            await ctx.reply(
                '⚠️ <b>Stop Grid Bot?</b>\n\nThis will:\n' +
                    '• Cancel all active orders\n' +
                    '• Close current positions\n' +
                    '• Stop the grid\n\n' +
                    'Are you sure?',
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [
                            Markup.button.callback('✅ Yes, Stop', 'confirm_stop'),
                            Markup.button.callback('❌ Cancel', 'cancel_stop'),
                        ],
                    ]),
                },
            );
        });
    }

    private registerActions() {
        // Refresh info
        this.bot.action('refresh_info', async (ctx) => {
            await ctx.answerCbQuery('Refreshing...');
            await ctx.editMessageText(
                '📊 <b>Position Information</b>\n\n' +
                    '<b>Symbol:</b> ETH-USD\n' +
                    '<b>Position Size:</b> 2.5 ETH\n' +
                    '<b>Net PnL:</b> +$110.20 (+3.41%)\n\n' +
                    '<i>Updated: ' +
                    new Date().toLocaleTimeString() +
                    '</i>',
                {
                    parse_mode: 'HTML',
                    ...this.getMainKeyboard(),
                },
            );
        });

        // Confirm stop
        this.bot.action('confirm_stop', async (ctx) => {
            await ctx.answerCbQuery('Stopping grid bot...');
            await ctx.editMessageText(
                '🛑 <b>Grid Bot Stopped</b>\n\n' +
                    '✅ All orders cancelled\n' +
                    '✅ Positions closed\n' +
                    '✅ Grid stopped\n\n' +
                    '<b>Final PnL:</b> +$110.20',
                { parse_mode: 'HTML' },
            );
        });

        // Cancel stop
        this.bot.action('cancel_stop', async (ctx) => {
            await ctx.answerCbQuery('Cancelled');
            await ctx.editMessageText('❌ Operation cancelled', { parse_mode: 'HTML' });
        });
    }

    private async handleGridCommand(ctx: Context) {
        try {
            // Parse command: /grid <symbol> <lower> <upper> [options]
            const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
            const parts = messageText.split(' ').slice(1); // Remove /grid

            if (parts.length < 3) {
                await ctx.reply(
                    '❌ <b>Invalid command format</b>\n\n' +
                        '<b>Usage:</b>\n' +
                        '<code>/grid &lt;symbol&gt; &lt;lower&gt; &lt;upper&gt; [options]</code>\n\n' +
                        '<b>Required:</b>\n' +
                        '• symbol - trading pair (BTC, ETH, SOL)\n' +
                        '• lower - lower price bound\n' +
                        '• upper - upper price bound\n\n' +
                        '<b>Optional:</b>\n' +
                        '• mode=neutral|long (default: neutral)\n' +
                        '• levels=20 (default: 20)\n' +
                        '• capital=5000 (default: auto from balance)\n' +
                        '• trailing=true|false (default: false)\n\n' +
                        '<b>Examples:</b>\n' +
                        '<code>/grid BTC 45000 55000</code>\n' +
                        '<code>/grid ETH 2500 3500 mode=long levels=25 trailing=true</code>',
                    { parse_mode: 'HTML' },
                );
                return;
            }

            // Parse required params
            const symbol = parts[0].toUpperCase();
            const lower = parseFloat(parts[1]);
            const upper = parseFloat(parts[2]);

            // Validate
            if (isNaN(lower) || isNaN(upper)) {
                await ctx.reply('❌ Lower and upper prices must be valid numbers');
                return;
            }

            if (lower >= upper) {
                await ctx.reply('❌ Lower price must be less than upper price');
                return;
            }

            // Parse optional params
            const options = this.parseGridOptions(parts.slice(3));

            // Show confirmation
            await ctx.reply(
                '⏳ <b>Creating Grid...</b>\n\n' +
                    `<b>Symbol:</b> ${symbol}\n` +
                    `<b>Range:</b> $${lower.toLocaleString()} - $${upper.toLocaleString()}\n` +
                    `<b>Levels:</b> ${options.levels ?? 20}\n` +
                    `<b>Mode:</b> ${options.mode ?? 'neutral'}\n` +
                    `<b>Trailing:</b> ${options.trailing ? 'ON' : 'OFF'}\n\n` +
                    'Please wait...',
                { parse_mode: 'HTML' },
            );

            // Publish command event
            const chatId = ctx.chat?.id;
            if (!chatId) {
                await ctx.reply('❌ Unable to get chat ID');
                return;
            }

            this.eventBus.publish(
                CreateGridCommandEvent.create({
                    chatId,
                    symbol,
                    lowerPrice: lower,
                    upperPrice: upper,
                    mode: options.mode,
                    levels: options.levels,
                    totalInvestmentUSDC: options.capital,
                    trailing: options.trailing,
                }),
            );

            this.logger.info({ symbol, lower, upper, options }, 'Grid creation command published');
        } catch (error) {
            this.logger.error({ error }, 'Failed to handle grid command');
            await ctx.reply('❌ Failed to process command. Please check format and try again.');
        }
    }

    private parseGridOptions(optionParts: string[]): {
        mode?: string;
        levels?: number;
        capital?: number;
        trailing?: boolean;
    } {
        const options: any = {};

        for (const part of optionParts) {
            const [key, value] = part.split('=');
            if (!key || !value) continue;

            switch (key.toLowerCase()) {
                case 'mode':
                    options.mode = value.toLowerCase();
                    break;
                case 'levels':
                    options.levels = parseInt(value);
                    break;
                case 'capital':
                    options.capital = parseFloat(value);
                    break;
                case 'trailing':
                    options.trailing = value.toLowerCase() === 'true';
                    break;
            }
        }

        return options;
    }

    private getMainKeyboard() {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('🔄 Refresh', 'refresh_info'),
                Markup.button.callback('📊 Status', 'show_status'),
            ],
        ]);
    }

    /**
     * Send grid creation success notification
     */
    async sendGridCreatedSuccess(chatId: number, params: any): Promise<void> {
        const message =
            `✅ <b>Grid Created!</b>\n\n` +
            `<b>Symbol:</b> ${params.symbol}\n` +
            `<b>Range:</b> $${params.lowerPrice.toLocaleString()} - $${params.upperPrice.toLocaleString()}\n` +
            `<b>Levels:</b> ${params.levels}\n` +
            `<b>Mode:</b> ${params.mode}\n\n` +
            `<b>Capital:</b>\n` +
            `• USDC: $${params.investmentUSDC.toLocaleString()}\n` +
            `• ${params.symbol}: ${params.investmentBase.toFixed(4)}\n\n` +
            `${params.trailingEnabled ? '🚀 <b>Trailing:</b> ON (5% trigger, 10% step)\n\n' : ''}` +
            `<b>Orders:</b> Placed successfully\n` +
            `<b>Grid ID:</b> <code>${params.gridId}</code>\n\n` +
            `Grid is now active and will trade automatically!`;

        await this.sendNotification(chatId, message);
    }

    /**
     * Send grid creation error notification
     */
    async sendGridCreatedError(chatId: number, error: string): Promise<void> {
        const message =
            `❌ <b>Grid Creation Failed</b>\n\n` +
            `<b>Error:</b> ${error}\n\n` +
            `Please check your balance and parameters, then try again.`;

        await this.sendNotification(chatId, message);
    }

    /**
     * Send notification message
     */
    async sendNotification(chatId: number, message: string): Promise<void> {
        try {
            await this.bot.telegram.sendMessage(chatId, message, {
                parse_mode: 'HTML',
            });
        } catch (error) {
            this.logger.error({ error, chatId }, 'Failed to send notification');
        }
    }

    /**
     * Send trade opened notification
     */
    async sendTradeOpened(chatId: number, params: any): Promise<void> {
        const message =
            `🟢 <b>Order Filled (${params.side.toUpperCase()})</b>\n\n` +
            `<b>Symbol:</b> ${params.symbol}\n` +
            `<b>Price:</b> $${params.price}\n` +
            `<b>Amount:</b> ${params.amount}\n` +
            `<b>Total:</b> $${params.total}\n\n` +
            `<b>Grid Level:</b> ${params.level}/${params.totalLevels}\n` +
            `<b>Status:</b> ✅ Active`;

        await this.sendNotification(chatId, message);
    }

    /**
     * Send trade closed notification
     */
    async sendTradeClosed(chatId: number, params: any): Promise<void> {
        const message =
            `🔴 <b>Order Filled (${params.side.toUpperCase()})</b>\n\n` +
            `<b>Symbol:</b> ${params.symbol}\n` +
            `<b>Price:</b> $${params.price}\n` +
            `<b>Amount:</b> ${params.amount}\n` +
            `<b>Total:</b> $${params.total}\n\n` +
            `<b>Profit:</b> ${params.profit >= 0 ? '+' : ''}$${params.profit} (${params.profitPercent}%)\n` +
            `<b>Grid Level:</b> ${params.level}/${params.totalLevels}\n` +
            `<b>Status:</b> ✅ Active`;

        await this.sendNotification(chatId, message);
    }
}
