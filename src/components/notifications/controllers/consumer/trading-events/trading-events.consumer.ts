import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../../../../infra/events/event-bus.service';
import { EventType } from '../../../../../domain/events/event-type';
import { TradeExecutedEvent } from '../../../../../domain/events/trade-executed.event';
import { GridStartedEvent } from '../../../../../domain/events/grid-started.event';
import { GridStoppedEvent } from '../../../../../domain/events/grid-stopped.event';
import { GridCreatedSuccessEvent } from '../../../../../domain/events/grid-created-success.event';
import { GridCreatedErrorEvent } from '../../../../../domain/events/grid-created-error.event';
import { TelegrafBotController } from '../../bot/telegram/telegraf-bot.controller';
import { ConfigService } from '@nestjs/config';
import { logger } from '../../../../../infra/logger/logger';

/**
 * Trading Events Consumer (SPOT Trading)
 *
 * Listens to events from Trading component and sends Telegram notifications.
 *
 * SPOT Trading Events:
 * - TradeExecutedEvent (buy/sell fills)
 * - GridStartedEvent
 * - GridStoppedEvent
 *
 * Note: No liquidation/funding events (not applicable to SPOT)
 *
 * This is how components communicate WITHOUT direct dependencies!
 */
@Injectable()
export class TradingEventsConsumer implements OnModuleInit {
    private readonly logger = logger.child({ context: TradingEventsConsumer.name });

    constructor(
        private readonly eventBus: EventBus,
        private readonly telegramBot: TelegrafBotController,
        private readonly configService: ConfigService,
    ) {}

    onModuleInit() {
        this.subscribeToEvents();
        this.logger.info('Trading events consumer initialized (SPOT mode)');
    }

    private subscribeToEvents() {
        // Subscribe to TradeExecutedEvent
        this.eventBus.subscribe(EventType.TradeExecuted, async (event: TradeExecutedEvent) => {
            await this.handleTradeExecuted(event);
        });

        // Subscribe to GridStartedEvent
        this.eventBus.subscribe(EventType.GridStarted, async (event: GridStartedEvent) => {
            await this.handleGridStarted(event);
        });

        // Subscribe to GridStoppedEvent
        this.eventBus.subscribe(EventType.GridStopped, async (event: GridStoppedEvent) => {
            await this.handleGridStopped(event);
        });

        // Subscribe to GridCreatedSuccessEvent
        this.eventBus.subscribe(
            EventType.GridCreatedSuccess,
            async (event: GridCreatedSuccessEvent) => {
                await this.handleGridCreatedSuccess(event);
            },
        );

        // Subscribe to GridCreatedErrorEvent
        this.eventBus.subscribe(
            EventType.GridCreatedError,
            async (event: GridCreatedErrorEvent) => {
                await this.handleGridCreatedError(event);
            },
        );

        // Note: No liquidation/funding events for SPOT trading
    }

    private async handleTradeExecuted(event: TradeExecutedEvent) {
        this.logger.info({ event }, 'Trade executed event received');

        const chatIds = this.getChatIds();

        for (const chatId of chatIds) {
            if (event.profit !== null) {
                // Trade closed (with profit/loss)
                await this.telegramBot.sendTradeClosed(chatId, {
                    symbol: event.symbol,
                    side: event.side,
                    price: event.price,
                    amount: event.amount,
                    total: event.total,
                    profit: event.profit,
                    profitPercent: ((event.profit / event.total) * 100).toFixed(2),
                    level: event.level,
                    totalLevels: event.totalLevels,
                });
            } else {
                // Trade opened
                await this.telegramBot.sendTradeOpened(chatId, {
                    symbol: event.symbol,
                    side: event.side,
                    price: event.price,
                    amount: event.amount,
                    total: event.total,
                    level: event.level,
                    totalLevels: event.totalLevels,
                });
            }
        }
    }

    private async handleGridStarted(event: GridStartedEvent) {
        this.logger.info({ event }, 'Grid started event received');

        const message =
            `✅ <b>Grid Started</b>\n\n` +
            `<b>Symbol:</b> ${event.symbol}\n` +
            `<b>Mode:</b> ${event.mode}\n` +
            `<b>Levels:</b> ${event.levels}`;

        const chatIds = this.getChatIds();

        for (const chatId of chatIds) {
            await this.telegramBot.sendNotification(chatId, message);
        }
    }

    private async handleGridStopped(event: GridStoppedEvent) {
        this.logger.info({ event }, 'Grid stopped event received');

        const message =
            `🛑 <b>Grid Stopped</b>\n\n` +
            `<b>Symbol:</b> ${event.symbol}\n` +
            `<b>Reason:</b> ${event.reason}`;

        const chatIds = this.getChatIds();

        for (const chatId of chatIds) {
            await this.telegramBot.sendNotification(chatId, message);
        }
    }

    private async handleGridCreatedSuccess(event: GridCreatedSuccessEvent) {
        this.logger.info({ event }, 'Grid created success event received');

        await this.telegramBot.sendGridCreatedSuccess(event.chatId, {
            gridId: event.gridId,
            symbol: event.symbol,
            mode: event.mode,
            lowerPrice: event.lowerPrice,
            upperPrice: event.upperPrice,
            levels: event.levels,
            investmentUSDC: event.investmentUSDC,
            investmentBase: event.investmentBase,
            trailingEnabled: event.trailingEnabled,
        });
    }

    private async handleGridCreatedError(event: GridCreatedErrorEvent) {
        this.logger.info({ event }, 'Grid created error event received');

        await this.telegramBot.sendGridCreatedError(event.chatId, event.error);
    }

    private getChatIds(): number[] {
        return this.configService
            .get<string>('TELEGRAM_ALLOWED_CHAT_IDS', '')
            .split(',')
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id));
    }
}
