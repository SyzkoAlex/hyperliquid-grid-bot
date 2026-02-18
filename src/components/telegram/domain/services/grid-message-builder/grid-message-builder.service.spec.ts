import { describe, it, expect, beforeEach } from 'vitest';
import { GridMessageBuilderService } from './grid-message-builder.service';
import { Grid } from '@domain/models/grid/grid';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';

function makeGrid(status: GridStatus = GridStatus.Running): Grid {
    return Grid.create({
        symbol: TradingSymbol.create('BTC'),
        mode: GridMode.Neutral,
        status,
        lowerPrice: Price.from(90000),
        upperPrice: Price.from(100000),
        levels: 10,
        investmentUSDC: Decimal.from(500),
        investmentBase: Decimal.from(0.001),
    });
}

describe('GridMessageBuilderService', () => {
    let service: GridMessageBuilderService;

    beforeEach(() => {
        service = new GridMessageBuilderService();
    });

    describe('buildGridList', () => {
        it('returns empty state message when no grids', () => {
            const result = service.buildGridList([]);
            expect(result).toContain('No grids found');
        });

        it('shows grid count in header', () => {
            const grids = [makeGrid(), makeGrid(GridStatus.Stopped)];
            const result = service.buildGridList(grids);
            expect(result).toContain('(2)');
        });

        it('includes symbol and status emoji for running grid', () => {
            const result = service.buildGridList([makeGrid(GridStatus.Running)]);
            expect(result).toContain('🟢');
            expect(result).toContain('BTC');
        });

        it('includes 🔴 for stopped grid', () => {
            const result = service.buildGridList([makeGrid(GridStatus.Stopped)]);
            expect(result).toContain('🔴');
        });
    });

    describe('buildGridCard', () => {
        it('includes symbol, mode, range and levels', () => {
            const grid = makeGrid();
            const result = service.buildGridCard(grid);
            expect(result).toContain('BTC');
            expect(result).toContain('neutral');
            expect(result).toContain('90000');
            expect(result).toContain('100000');
            expect(result).toContain('10');
        });
    });
});
