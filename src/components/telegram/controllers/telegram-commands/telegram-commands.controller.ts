import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { logger } from '@infra/logger/logger';
import { TELEGRAM_SERVICE, TelegramService } from '../../core/services/telegram.service';
import { StartHandler } from './handlers/start/start.handler';
import { HelpHandler } from './handlers/help/help.handler';
import { MainMenuHandler } from './handlers/main-menu/main-menu.handler';
import { CREATE_GRID_SCENE_ID } from './scenes/create-grid/create-grid.scene';
import { TelegrafCreateGridSceneAdapter } from '../../secondary/services/telegram-bot/scenes/telegraf-create-grid-scene.adapter';
import { TelegramAction } from '../../core/domain/telegram-command.enum';
import { MessageContext } from '../../core/domain/message-context';

@Injectable()
export class TelegramCommandsController implements OnModuleInit {
    private readonly logger = logger.child({ context: TelegramCommandsController.name });

    constructor(
        @Inject(TELEGRAM_SERVICE) private readonly telegramService: TelegramService,
        private readonly startHandler: StartHandler,
        private readonly helpHandler: HelpHandler,
        private readonly mainMenuHandler: MainMenuHandler,
        private readonly createGridSceneAdapter: TelegrafCreateGridSceneAdapter,
    ) {}

    async onModuleInit() {
        this.registerScenes();
        this.registerHandlers();
        await this.telegramService.launch();
        this.logger.info('Telegram bot controller initialized');
    }

    private registerScenes() {
        this.telegramService.registerScene(this.createGridSceneAdapter);
    }

    private registerHandlers() {
        this.startHandler.register();
        this.helpHandler.register();
        this.mainMenuHandler.register();
        this.registerCreateGridHandler();
    }

    private registerCreateGridHandler() {
        this.telegramService.onAction(TelegramAction.CreateGrid, (ctx: MessageContext) =>
            this.handleCreateGrid(ctx),
        );
    }

    private async handleCreateGrid(ctx: MessageContext): Promise<void> {
        await ctx.answerCallback();
        await ctx.scene.enter(CREATE_GRID_SCENE_ID);
    }
}
