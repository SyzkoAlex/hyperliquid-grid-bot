import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBus } from '@/infra/events/event-bus.port';
import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { StopGridCommandEvent } from '@domain/models/events/commands/stop-grid-command.event';
import { CreateGridHandler } from './handlers/create-grid/create-grid.handler';
import { StopGridHandler } from './handlers/stop-grid/stop-grid.handler';
import { EventType } from '@domain/models/events/event-type';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class GridCommandsController implements OnModuleInit {
    private readonly logger = logger.child({ context: GridCommandsController.name });

    constructor(
        @Inject(EVENT_BUS) private readonly eventBus: EventBus,
        private readonly createGridHandler: CreateGridHandler,
        private readonly stopGridHandler: StopGridHandler,
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
        this.eventBus.subscribe(EventType.StopGridCommand, async (event: StopGridCommandEvent) => {
            await this.stopGridHandler.handle(event);
        });
    }
}
