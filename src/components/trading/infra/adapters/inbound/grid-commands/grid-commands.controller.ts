import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBus } from '@infra/events/event-bus.port';
import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { CreateGridHandler } from './handlers/create-grid/create-grid.handler';
import { EventType } from '@domain/models/events/event-type';
import { logger } from '@infra/logger/logger';

@Injectable()
export class GridCommandsController implements OnModuleInit {
    private readonly logger = logger.child({ context: GridCommandsController.name });

    constructor(
        @Inject(EVENT_BUS) private readonly eventBus: EventBus,
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
