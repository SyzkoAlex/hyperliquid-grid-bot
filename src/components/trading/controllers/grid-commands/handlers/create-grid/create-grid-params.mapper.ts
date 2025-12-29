import { CreateGridCommandEvent } from '../../../../../../domain/events/create-grid-command.event';
import { CreateAndStartGridParams } from '../../../../core/use-cases/create-and-start-grid/create-and-start-grid-params';
import { GridMode } from '../../../../core/domain/grid/grid-mode';

export class CreateGridParamsMapper {
    static fromCommand(command: CreateGridCommandEvent, address: string): CreateAndStartGridParams {
        return {
            chatId: command.chatId,
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
            case 'short':
                return GridMode.Short;
            default:
                throw new Error(`Invalid grid mode: ${mode}`);
        }
    }
}
