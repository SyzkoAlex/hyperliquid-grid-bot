import { Injectable } from '@nestjs/common';
import { Grid } from '@domain/grid/grid';
import { GridStatus } from '@domain/grid/grid-status';
import { PriceFormatter } from '../../domain/formatters/price.formatter';

@Injectable()
export class GridMessageBuilderService {
    buildGridList(grids: Grid[]): string {
        if (grids.length === 0) {
            return '<b>📋 My Grids</b>\n\nNo grids found. Create your first grid!';
        }

        const lines = grids.map((grid) => this.buildGridListItem(grid));
        return `<b>📋 My Grids</b> (${grids.length})\n\n${lines.join('\n\n')}`;
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

    private buildGridListItem(grid: Grid): string {
        const status = this.statusEmoji(grid.status);
        const symbol = grid.symbol.toString();
        const lower = PriceFormatter.format(grid.lowerPrice.toNumber());
        const upper = PriceFormatter.format(grid.upperPrice.toNumber());
        const id = grid.id.toString();

        return (
            `${status} <b>${symbol}</b> · ${grid.mode} · ${grid.status}\n` +
            `  $${lower} – $${upper} · ${grid.levels} levels\n` +
            `  <code>${id.slice(0, 8)}</code>`
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
