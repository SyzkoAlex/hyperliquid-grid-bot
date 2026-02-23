import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { CreateAndStartGridResult } from '@components/trading/core/application/use-cases/create-and-start-grid/create-and-start-grid-result';

export class GridCreatedSuccessEventMapper {
    static fromResult(result: CreateAndStartGridResult): GridCreatedSuccessEvent {
        return new GridCreatedSuccessEvent(
            result.grid.id.toString(),
            result.grid.symbol.toString(),
            result.grid.mode,
            result.grid.lowerPrice.toNumber(),
            result.grid.upperPrice.toNumber(),
            result.grid.levels,
            result.investmentUSDC.toNumber(),
            result.investmentBase.toNumber(),
            result.grid.trailingEnabled,
        );
    }
}
