import { describe, it, expect } from 'vitest';
import { GridCardData, GridListItemMessage } from './grid-list-item.message';
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

function makeData(grid: Grid, pnl: number): GridCardData {
    return { grid, pnl, currentPrice: 95000, profitableTrades: 5 };
}

describe('GridListItemMessage', () => {
    describe('fromCardData', () => {
        it('shows symbol as pair with /USDC', () => {
            expect(GridListItemMessage.fromCardData(makeData(makeGrid(), 0))).toContain('BTC/USDC');
        });

        it('shows 🟢 and Active for running grid', () => {
            const result = GridListItemMessage.fromCardData(
                makeData(makeGrid(GridStatus.Running), 0),
            );
            expect(result).toContain('🟢');
            expect(result).toContain('Active');
        });

        it('shows 🔴 and Stopped for stopped grid', () => {
            const result = GridListItemMessage.fromCardData(
                makeData(makeGrid(GridStatus.Stopped), 0),
            );
            expect(result).toContain('🔴');
            expect(result).toContain('Stopped');
        });

        it('shows positive PnL with + sign', () => {
            expect(GridListItemMessage.fromCardData(makeData(makeGrid(), 12.5))).toContain(
                '+$12.5',
            );
        });

        it('shows negative PnL with - sign', () => {
            expect(GridListItemMessage.fromCardData(makeData(makeGrid(), -5.25))).toContain(
                '-$5.25',
            );
        });

        it('shows PnL percentage', () => {
            // 12.5 / 500 * 100 = 2.50%
            expect(GridListItemMessage.fromCardData(makeData(makeGrid(), 12.5))).toContain(
                '+2.50%',
            );
        });

        it('shows current price', () => {
            expect(GridListItemMessage.fromCardData(makeData(makeGrid(), 0))).toContain('95000');
        });

        it('shows price range', () => {
            const result = GridListItemMessage.fromCardData(makeData(makeGrid(), 0));
            expect(result).toContain('90000');
            expect(result).toContain('100000');
        });

        it('shows profitable trades count', () => {
            expect(GridListItemMessage.fromCardData(makeData(makeGrid(), 0))).toContain(
                'Profitable Trades:</b> 5',
            );
        });

        it('shows grid short id', () => {
            expect(GridListItemMessage.fromCardData(makeData(makeGrid(), 0))).toContain('Grid (');
        });
    });
});
