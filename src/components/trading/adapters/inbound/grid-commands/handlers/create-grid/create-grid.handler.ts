import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EVENT_BUS, EventBus } from '@/infra/events/event-bus.port';
import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';
import { CreateAndStartGridUseCase } from '@components/trading/core/application/use-cases/create-and-start-grid/create-and-start-grid.use-case';
import { CreateGridParamsMapper } from './create-grid-params.mapper';
import { GridCreatedSuccessEventMapper } from './grid-created-success-event.mapper';
import { logger } from '@/infra/logger/logger';
import { Config } from '@/config/config.schema';

@Injectable()
export class CreateGridHandler {
    private readonly logger = logger.child({ context: CreateGridHandler.name });
    private readonly accountAddress: string;

    constructor(
        @Inject(EVENT_BUS) private readonly eventBus: EventBus,
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

            const successEvent = GridCreatedSuccessEventMapper.fromResult(result);
            await this.eventBus.publish(successEvent);
        } catch (error) {
            this.logger.error({ error, command }, 'Failed to create grid');

            const errorEvent = new GridCreatedErrorEvent(
                error instanceof Error ? error.message : 'Unknown error',
            );
            await this.eventBus.publish(errorEvent);
        }
    }
}
