import { Injectable } from '@nestjs/common';
import { StopGridCommandEvent } from '@domain/models/events/commands/stop-grid-command.event';
import { StopGridUseCase } from '@components/trading/core/application/use-cases/stop-grid/stop-grid.use-case';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class StopGridHandler {
    private readonly logger = logger.child({ context: StopGridHandler.name });

    constructor(private readonly stopGridUseCase: StopGridUseCase) {}

    async handle(command: StopGridCommandEvent): Promise<void> {
        try {
            this.logger.info({ command }, 'Received StopGrid command');
            await this.stopGridUseCase.execute(command.gridId, command.accountAddress);
            this.logger.info({ gridId: command.gridId }, 'StopGrid command handled successfully');
        } catch (error) {
            this.logger.error({ error, command }, 'Failed to handle StopGrid command');
        }
    }
}
