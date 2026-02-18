import { Injectable, OnModuleInit } from '@nestjs/common';
import { logger } from '@infra/logger/logger';
import { TelegramBotService } from '@components/telegram/infra/adapters/inbound/telegram-bot/telegram-bot.service';
import { StartHandler } from '@components/telegram/infra/adapters/inbound/telegram-bot/handlers/start/start.handler';
import { HelpHandler } from '@components/telegram/infra/adapters/inbound/telegram-bot/handlers/help/help.handler';
import { MainMenuHandler } from '@components/telegram/infra/adapters/inbound/telegram-bot/handlers/main-menu/main-menu.handler';
import { GridsHandler } from '@components/telegram/infra/adapters/inbound/telegram-bot/handlers/grids/grids.handler';
import {
    CREATE_GRID_SCENE_ID,
    CreateGridSceneHandler,
} from '@components/telegram/infra/adapters/inbound/telegram-bot/scenes/create-grid/create-grid.scene';
import { TelegramAction } from '@components/telegram/domain/models/telegram-command.enum';
import { BotContext } from '@components/telegram/infra/adapters/inbound/telegram-bot/types/bot-context';

@Injectable()
export class TelegramCommandsController implements OnModuleInit {
    private readonly logger = logger.child({ context: TelegramCommandsController.name });

    constructor(
        private readonly telegramBotService: TelegramBotService,
        private readonly startHandler: StartHandler,
        private readonly helpHandler: HelpHandler,
        private readonly mainMenuHandler: MainMenuHandler,
        private readonly gridsHandler: GridsHandler,
        private readonly createGridSceneHandler: CreateGridSceneHandler,
    ) {}

    async onModuleInit() {
        this.registerScenes();
        this.registerHandlers();
        await this.telegramBotService.launch();
        this.logger.info('Telegram bot controller initialized');
    }

    private registerScenes() {
        this.telegramBotService.registerScene(this.createGridSceneHandler);
    }

    private registerHandlers() {
        this.startHandler.register();
        this.helpHandler.register();
        this.mainMenuHandler.register();
        this.gridsHandler.register();
        this.registerCreateGridHandler();
    }

    private registerCreateGridHandler() {
        this.telegramBotService.onAction(TelegramAction.CreateGrid, (ctx: BotContext) =>
            this.handleCreateGrid(ctx),
        );
    }

    private async handleCreateGrid(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await ctx.scene.enter(CREATE_GRID_SCENE_ID);
    }
}
