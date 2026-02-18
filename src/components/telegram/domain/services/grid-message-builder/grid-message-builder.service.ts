import { Injectable } from '@nestjs/common';
import { Grid } from '@domain/models/grid/grid';
import { GridStatus } from '@domain/models/grid/grid-status';
import { PriceFormatter } from '@components/telegram/domain/models/formatters/price.formatter';
import { GridWithPnl } from '@components/telegram/application/use-cases/get-grids-with-pnl/grid-with-pnl';
import { GridsListMessages } from '@components/telegram/domain/models/messages/grids-list.messages';

@Injectable()
export class GridMessageBuilderService {
    buildGridList(items: GridWithPnl[]): string {
        return GridsListMessages.list(items);
    }

    buildGridCard(grid: Grid): string {
        const status = this.statusEmoji(grid.status);
        const symbol = grid.symbol.toString();
        const lower = PriceFormatter.format(grid.lowerPrice.toNumber());
        const upper = PriceFormatter.format(grid.upperPrice.toNumber());

        return (
            `${status} <b>${symbol}</b> · ${grid.mode}\n` +
            `  Range: $${lower} – $${upper}\n` +
            `  Levels: ${grid.levels} · Invest: $${PriceFormatter.format(grid.investmentUSDC.toNumber())}`
        );
    }

    private statusEmoji(status: GridStatus): string {
        switch (status) {
            case GridStatus.Running:
                return '🟢';
            case GridStatus.Stopped:
                return '🔴';
            case GridStatus.Paused:
                return '⏸';
            case GridStatus.Idle:
                return '🔵';
            default:
                return '⚠️';
        }
    }
}
