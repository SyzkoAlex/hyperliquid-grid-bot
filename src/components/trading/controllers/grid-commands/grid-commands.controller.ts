import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../../../infra/events/event-bus.service';
import { CreateGridCommandEvent } from '@domain/events/commands/create-grid-command.event';
import { CreateGridHandler } from './handlers/create-grid/create-grid.handler';
import { EventType } from '@domain/events/event-type';
import { logger } from '../../../../infra/logger/logger';

@Injectable()
export class GridCommandsController implements OnModuleInit {
    private readonly logger = logger.child({ context: GridCommandsController.name });

    constructor(
        private readonly eventBus: EventBus,
        private readonly createGridHandler: CreateGridHandler,
    ) {}

    onModuleInit() {
        this.subscribeToCommands();
        this.logger.info('Grid commands consumer initialized');
    }

    private subscribeToCommands() {
        this.eventBus.subscribe(
            EventType.CreateGridCommand,
            async (event: CreateGridCommandEvent) => {
                await this.createGridHandler.handle(event);
            },
        );
    }
}
