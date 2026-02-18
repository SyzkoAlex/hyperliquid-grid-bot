import { describe, it, expect, beforeEach } from 'vitest';
import { GridMessageBuilderService } from './grid-message-builder.service';
import { Grid } from '@domain/models/grid/grid';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { GridWithPnl } from '@components/telegram/application/use-cases/get-grids-with-pnl/grid-with-pnl';

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

function makeItem(grid: Grid, pnl: number): GridWithPnl {
    return { grid, pnl, currentPrice: 95000, profitableTrades: 5 };
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
            const items = [makeItem(makeGrid(), 0), makeItem(makeGrid(GridStatus.Stopped), -10)];
            const result = service.buildGridList(items);
            expect(result).toContain('(2)');
        });

        it('includes symbol and status emoji for running grid', () => {
            const result = service.buildGridList([makeItem(makeGrid(GridStatus.Running), 0)]);
            expect(result).toContain('🟢');
            expect(result).toContain('BTC/USDC');
        });

        it('includes 🔴 for stopped grid', () => {
            const result = service.buildGridList([makeItem(makeGrid(GridStatus.Stopped), 0)]);
            expect(result).toContain('🔴');
        });

        it('shows positive PnL with + sign', () => {
            const result = service.buildGridList([makeItem(makeGrid(), 12.5)]);
            expect(result).toContain('+$12.5');
        });

        it('shows negative PnL without + sign', () => {
            const result = service.buildGridList([makeItem(makeGrid(), -5.25)]);
            expect(result).toContain('-$5.25');
        });

        it('shows PnL percentage', () => {
            // 12.5 / 500 * 100 = 2.50%
            const result = service.buildGridList([makeItem(makeGrid(), 12.5)]);
            expect(result).toContain('+2.50%');
        });

        it('shows current price', () => {
            const result = service.buildGridList([makeItem(makeGrid(), 0)]);
            expect(result).toContain('95000');
        });

        it('shows price range', () => {
            const result = service.buildGridList([makeItem(makeGrid(), 0)]);
            expect(result).toContain('90000');
            expect(result).toContain('100000');
        });

        it('shows profitable trades count', () => {
            const result = service.buildGridList([makeItem(makeGrid(), 0)]);
            expect(result).toContain('Profitable Trades: 5');
        });

        it('shows Active label for running grid', () => {
            const result = service.buildGridList([makeItem(makeGrid(GridStatus.Running), 0)]);
            expect(result).toContain('Active');
        });

        it('shows grid short id', () => {
            const result = service.buildGridList([makeItem(makeGrid(), 0)]);
            expect(result).toContain('Grid (');
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
