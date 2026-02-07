import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { logger } from '@infra/logger/logger';
import { COMMAND_REGISTRAR, CommandRegistrar } from '../../core/services/command-registrar.service';
import { StartHandler } from './handlers/start/start.handler';
import { HelpHandler } from './handlers/help/help.handler';
import { MainMenuHandler } from './handlers/main-menu/main-menu.handler';

@Injectable()
export class TelegramCommandsController implements OnModuleInit {
    private readonly logger = logger.child({ context: TelegramCommandsController.name });

    constructor(
        @Inject(COMMAND_REGISTRAR) private readonly registrar: CommandRegistrar,
        private readonly startHandler: StartHandler,
        private readonly helpHandler: HelpHandler,
        private readonly mainMenuHandler: MainMenuHandler,
    ) {}

    async onModuleInit() {
        this.registerHandlers();
        await this.registrar.launch();
        this.logger.info('Telegram bot controller initialized');
    }

    private registerHandlers() {
        this.startHandler.register();
        this.helpHandler.register();
        this.mainMenuHandler.register();
    }
}
