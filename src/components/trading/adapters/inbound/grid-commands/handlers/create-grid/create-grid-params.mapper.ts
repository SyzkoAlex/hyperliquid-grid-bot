import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { CreateAndStartGridParams } from '@components/trading/core/application/use-cases/create-and-start-grid/create-and-start-grid-params';

export class CreateGridParamsMapper {
    static fromCommand(command: CreateGridCommandEvent, address: string): CreateAndStartGridParams {
        return {
            address,
            symbol: command.symbol,
            lowerPrice: command.lowerPrice,
            upperPrice: command.upperPrice,
            levels: command.levels,
            totalInvestmentUSDC: command.totalInvestmentUSDC,
            trailingEnabled: command.trailing,
        };
    }
}
