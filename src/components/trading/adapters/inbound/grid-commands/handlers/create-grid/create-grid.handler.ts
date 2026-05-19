import { Inject, Injectable } from '@nestjs/common';
import {
    EVENT_PUBLISHER_PORT,
    EventPublisherPort,
} from '@/core/application/ports/outbound/event-publisher.port';
import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';
import { CreateAndStartGridUseCase } from '@components/trading/core/application/use-cases/create-and-start-grid/create-and-start-grid.use-case';
import { CreateGridParamsMapper } from './create-grid-params.mapper';
import { GridCreatedSuccessEventMapper } from './grid-created-success-event.mapper';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class CreateGridHandler {
    private readonly logger = logger.child({ context: CreateGridHandler.name });

    constructor(
        @Inject(EVENT_PUBLISHER_PORT) private readonly publisher: EventPublisherPort,
        private readonly createAndStartGrid: CreateAndStartGridUseCase,
    ) {}

    async handle(command: CreateGridCommandEvent): Promise<void> {
        try {
            this.logger.info({ command }, 'Received CreateGrid command');

            const params = CreateGridParamsMapper.fromCommand(command);
            const result = await this.createAndStartGrid.execute(params);

            this.logger.info({ command }, 'Grid creation completed successfully');

            const successEvent = GridCreatedSuccessEventMapper.fromResult(result);
            await this.publisher.publish(successEvent);
        } catch (error) {
            this.logger.error({ error, command }, 'Failed to create grid');

            const errorEvent = new GridCreatedErrorEvent(
                error instanceof Error ? error.message : 'Unknown error',
                command.accountAddress,
            );
            await this.publisher.publish(errorEvent);
        }
    }
}
