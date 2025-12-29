import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '../../../../../../infra/events/event-bus.service';
import { CreateGridCommandEvent } from '../../../../../../domain/events/create-grid-command.event';
import { GridCreatedErrorEvent } from '../../../../../../domain/events/grid-created-error.event';
import { CreateAndStartGridUseCase } from '../../../../core/use-cases/create-and-start-grid/create-and-start-grid.use-case';
import { CreateGridParamsMapper } from './create-grid-params.mapper';
import { GridCreatedSuccessEventMapper } from './grid-created-success-event.mapper';
import { logger } from '../../../../../../infra/logger/logger';
import { Config } from '@/infra/config/config.schema';

@Injectable()
export class CreateGridHandler {
    private readonly logger = logger.child({ context: CreateGridHandler.name });
    private readonly accountAddress: string;

    constructor(
        private readonly eventBus: EventBus,
        private readonly createAndStartGrid: CreateAndStartGridUseCase,
        configService: ConfigService<Config, true>,
    ) {
        this.accountAddress = configService.get('hyperliquid.accountAddress', { infer: true });
    }

    async handle(command: CreateGridCommandEvent): Promise<void> {
        try {
            this.logger.info({ command }, 'Received CreateGrid command');

            const params = CreateGridParamsMapper.fromCommand(command, this.accountAddress);
            const result = await this.createAndStartGrid.execute(params);

            this.logger.info({ command }, 'Grid creation completed successfully');

            const successEvent = GridCreatedSuccessEventMapper.fromResult(command.chatId, result);
            this.eventBus.publish(successEvent);
        } catch (error) {
            this.logger.error({ error, command }, 'Failed to create grid');

            this.eventBus.publish(
                new GridCreatedErrorEvent(
                    command.chatId,
                    error instanceof Error ? error.message : 'Unknown error',
                ),
            );
        }
    }
}
