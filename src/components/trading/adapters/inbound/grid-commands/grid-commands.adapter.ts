import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
    EVENT_SUBSCRIBER_PORT,
    EventSubscriberPort,
} from '@/core/application/ports/inbound/event-subscriber.port';
import { SerializableEvent } from '@domain/models/events/trading/trading-event';
import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { StopGridCommandEvent } from '@domain/models/events/commands/stop-grid-command.event';
import { EventDeserializer } from '@domain/models/events/event-deserializer';
import { CreateGridHandler } from './handlers/create-grid/create-grid.handler';
import { StopGridHandler } from './handlers/stop-grid/stop-grid.handler';
import { EventType } from '@domain/models/events/event-type';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class GridCommandsAdapter implements OnModuleInit {
    private readonly logger = logger.child({ context: GridCommandsAdapter.name });

    constructor(
        @Inject(EVENT_SUBSCRIBER_PORT) private readonly subscriber: EventSubscriberPort,
        private readonly deserializer: EventDeserializer,
        private readonly createGridHandler: CreateGridHandler,
        private readonly stopGridHandler: StopGridHandler,
    ) {}

    onModuleInit() {
        this.subscribeToCommands();
        this.logger.info('Grid commands consumer initialized');
    }

    private subscribeToCommands() {
        this.subscriber.subscribe<SerializableEvent>(
            EventType.CreateGridCommand,
            async (event: SerializableEvent) => {
                const typed = this.deserializer.deserialize(
                    event.eventType,
                    event.serialize(),
                ) as CreateGridCommandEvent;
                await this.createGridHandler.handle(typed);
            },
        );
        this.subscriber.subscribe<SerializableEvent>(
            EventType.StopGridCommand,
            async (event: SerializableEvent) => {
                const typed = this.deserializer.deserialize(
                    event.eventType,
                    event.serialize(),
                ) as StopGridCommandEvent;
                await this.stopGridHandler.handle(typed);
            },
        );
    }
}
