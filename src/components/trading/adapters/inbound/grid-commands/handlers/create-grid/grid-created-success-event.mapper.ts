import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { CreateAndStartGridResult } from '@components/trading/core/application/use-cases/create-and-start-grid/create-and-start-grid-result';

export class GridCreatedSuccessEventMapper {
    static fromResult(result: CreateAndStartGridResult): GridCreatedSuccessEvent {
        return new GridCreatedSuccessEvent(
            result.grid.id,
            result.grid.symbol,
            result.grid.lowerPrice,
            result.grid.upperPrice,
            result.grid.levels,
            result.investmentUSDC.toNumber(),
            result.investmentBase.toNumber(),
            result.grid.trailingEnabled,
        );
    }
}
