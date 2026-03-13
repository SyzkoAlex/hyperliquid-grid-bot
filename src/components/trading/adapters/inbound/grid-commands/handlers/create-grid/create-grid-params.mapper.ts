import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { CreateAndStartGridParams } from '@components/trading/core/application/use-cases/create-and-start-grid/create-and-start-grid-params';
import { GridMode } from '@domain/models/grid/grid-mode';

export class CreateGridParamsMapper {
    static fromCommand(command: CreateGridCommandEvent, address: string): CreateAndStartGridParams {
        return {
            address,
            symbol: command.symbol,
            mode: this.parseMode(command.mode),
            lowerPrice: command.lowerPrice,
            upperPrice: command.upperPrice,
            levels: command.levels,
            totalInvestmentUSDC: command.totalInvestmentUSDC,
            trailingEnabled: command.trailing,
        };
    }

    private static parseMode(mode: string): GridMode {
        switch (mode.toLowerCase()) {
            case 'neutral':
                return GridMode.Neutral;
            case 'long':
                return GridMode.Long;
            default:
                throw new Error(`Invalid grid mode: ${mode}`);
        }
    }
}
