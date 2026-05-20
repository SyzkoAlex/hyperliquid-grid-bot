import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TelegramError } from 'telegraf';
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
import { ConnectAccountHandler } from '@components/telegram/adapters/inbound/telegram-bot/handlers/connect-account/connect-account.handler';
import { SettingsHandler } from '@components/telegram/adapters/inbound/telegram-bot/handlers/settings/settings.handler';
import {
    CREATE_GRID_SCENE_ID,
    CreateGridSceneHandler,
} from '@components/telegram/adapters/inbound/telegram-bot/scenes/create-grid/create-grid.scene';
import { ConnectAccountSceneHandler } from '@components/telegram/adapters/inbound/telegram-bot/scenes/connect-account/connect-account.scene';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { BotContext } from '@components/telegram/adapters/inbound/telegram-bot/types/bot-context';
import { ManagedLockHandle } from '@/core/application/services/managed-lock/managed-lock-handle';
import { ManagedLockService } from '@/core/application/services/managed-lock/managed-lock.service';
import { UserStatus } from '@domain/models/user/user-status';
import { replyConnectCta } from '../telegram-bot/handlers/connect-cta.keyboard';

@Injectable()
export class TelegramCommandsAdapter implements OnModuleInit, OnModuleDestroy {
    private readonly logger = logger.child({ context: TelegramCommandsAdapter.name });
    private managedLockHandle: ManagedLockHandle | null = null;
    private isRegistered = false;

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
        private readonly connectAccountHandler: ConnectAccountHandler,
        private readonly settingsHandler: SettingsHandler,
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
        await this.telegramBotService.stopAndWait();
        await this.managedLockHandle?.dispose();
    }

    private async startBot() {
        if (!this.isRegistered) {
            this.registerScenes();
            this.registerHandlers();
            this.isRegistered = true;
        }
        try {
            await this.telegramBotService.launch();
        } catch (err) {
            if (err instanceof TelegramError && err.code === 409) {
                this.logger.warn(
                    { errorDescription: err.description },
                    'Telegram 409 Conflict: another getUpdates session is still active — likely a deployment race',
                );
            }
            throw err;
        }
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
        this.connectAccountHandler.register();
        this.settingsHandler.register();
        this.registerCreateGridHandler();
    }

    private registerCreateGridHandler() {
        this.telegramBotService.onAction(TelegramAction.CreateGrid, (ctx: BotContext) =>
            this.handleCreateGrid(ctx),
        );
        this.telegramBotService.onHears(BUTTON_LABELS.CREATE_GRID, (ctx: BotContext) =>
            this.handleCreateGridHears(ctx),
        );
    }

    private async handleCreateGrid(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await this.routeCreateGrid(ctx);
    }

    private async handleCreateGridHears(ctx: BotContext): Promise<void> {
        await this.routeCreateGrid(ctx);
    }

    private async routeCreateGrid(ctx: BotContext): Promise<void> {
        if (ctx.user?.status !== UserStatus.Active) {
            await replyConnectCta(ctx);
            return;
        }
        await ctx.scene.enter(CREATE_GRID_SCENE_ID);
    }
}
