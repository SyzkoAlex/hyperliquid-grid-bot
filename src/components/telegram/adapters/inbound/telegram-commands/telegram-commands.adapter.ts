import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { logger } from '@/infra/logger/logger';
import { TelegramBotService } from '@components/telegram/adapters/inbound/telegram-bot/telegram-bot.service';
import { StartHandler } from '@components/telegram/adapters/inbound/telegram-bot/handlers/start/start.handler';
import { HelpHandler } from '@components/telegram/adapters/inbound/telegram-bot/handlers/help/help.handler';
import { GridsHandler } from '@components/telegram/adapters/inbound/telegram-bot/handlers/grids/grids.handler';
import { GridProfitTabHandler } from '@components/telegram/adapters/inbound/telegram-bot/handlers/grid-view/grid-profit-tab.handler';
import { GridOrdersTabHandler } from '@components/telegram/adapters/inbound/telegram-bot/handlers/grid-view/grid-orders-tab.handler';
import { GridHistoryTabHandler } from '@components/telegram/adapters/inbound/telegram-bot/handlers/grid-view/grid-history-tab.handler';
import { StopGridHandler } from '@components/telegram/adapters/inbound/telegram-bot/handlers/grid-view/stop-grid.handler';
import { BalanceHandler } from '@components/telegram/adapters/inbound/telegram-bot/handlers/balance/balance.handler';
import {
    CREATE_GRID_SCENE_ID,
    CreateGridSceneHandler,
} from '@components/telegram/adapters/inbound/telegram-bot/scenes/create-grid/create-grid.scene';
import { ConnectAccountSceneHandler } from '@components/telegram/adapters/inbound/telegram-bot/scenes/connect-account/connect-account.scene';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { CommonTexts } from '@components/telegram/core/domain/models/messages/common.texts';
import { BotContext } from '@components/telegram/adapters/inbound/telegram-bot/types/bot-context';
import { ManagedLockHandle } from '@/core/application/services/managed-lock/managed-lock-handle';
import { ManagedLockService } from '@/core/application/services/managed-lock/managed-lock.service';

// Time to wait after stopping the bot before releasing the lock, to let in-flight
// getUpdates responses finish processing before another instance can acquire the lock.
const BOT_DRAIN_DELAY_MS = 2000;

@Injectable()
export class TelegramCommandsAdapter implements OnModuleInit, OnModuleDestroy {
    private readonly logger = logger.child({ context: TelegramCommandsAdapter.name });
    private managedLockHandle: ManagedLockHandle | null = null;

    constructor(
        private readonly telegramBotService: TelegramBotService,
        private readonly startHandler: StartHandler,
        private readonly helpHandler: HelpHandler,
        private readonly gridsHandler: GridsHandler,
        private readonly gridProfitTabHandler: GridProfitTabHandler,
        private readonly gridOrdersTabHandler: GridOrdersTabHandler,
        private readonly gridHistoryTabHandler: GridHistoryTabHandler,
        private readonly stopGridHandler: StopGridHandler,
        private readonly balanceHandler: BalanceHandler,
        private readonly createGridSceneHandler: CreateGridSceneHandler,
        private readonly connectAccountSceneHandler: ConnectAccountSceneHandler,
        private readonly managedLock: ManagedLockService,
        private readonly configService: ConfigService<Config, true>,
    ) {}

    async onModuleInit() {
        const { botLockTtlMs } = this.configService.get('telegram', { infer: true });

        this.managedLockHandle = this.managedLock.hold({
            lockName: 'telegram-bot',
            ttlMs: botLockTtlMs,
            onAcquired: () => this.startBot(),
            onLost: () => this.stopBot(),
        });
    }

    async onModuleDestroy() {
        this.telegramBotService.stop();
        await new Promise<void>((resolve) => setTimeout(resolve, BOT_DRAIN_DELAY_MS));
        await this.managedLockHandle?.dispose();
    }

    private async startBot() {
        this.registerScenes();
        this.registerHandlers();
        await this.telegramBotService.launch();
        this.logger.info('Telegram bot started (lock acquired)');
    }

    private async stopBot(): Promise<void> {
        this.telegramBotService.stop();
        this.logger.info('Telegram bot stopped (lock lost)');
    }

    private registerScenes() {
        this.telegramBotService.registerScene(this.createGridSceneHandler);
        this.telegramBotService.registerScene(this.connectAccountSceneHandler);
    }

    private registerHandlers() {
        this.startHandler.register();
        this.helpHandler.register();
        this.gridsHandler.register();
        this.gridProfitTabHandler.register();
        this.gridOrdersTabHandler.register();
        this.gridHistoryTabHandler.register();
        this.stopGridHandler.register();
        this.balanceHandler.register();
        this.registerCreateGridHandler();
        this.registerStubHandlers();
    }

    private registerCreateGridHandler() {
        this.telegramBotService.onAction(TelegramAction.CreateGrid, (ctx: BotContext) =>
            this.handleCreateGrid(ctx),
        );
        this.telegramBotService.onHears(BUTTON_LABELS.CREATE_GRID, async (ctx: BotContext) => {
            await ctx.scene.enter(CREATE_GRID_SCENE_ID);
        });
    }

    private async handleCreateGrid(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await ctx.scene.enter(CREATE_GRID_SCENE_ID);
    }

    private registerStubHandlers() {
        const stubReply = async (ctx: BotContext) => {
            await ctx.reply(CommonTexts.COMING_SOON);
        };
        const stubAction = async (ctx: BotContext) => {
            await ctx.answerCbQuery();
            await ctx.editMessageText(CommonTexts.COMING_SOON);
        };

        this.telegramBotService.onHears(BUTTON_LABELS.SETTINGS, stubReply);
        this.telegramBotService.onAction(TelegramAction.ShowSettings, stubAction);
    }
}
