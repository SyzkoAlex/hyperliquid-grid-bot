import { describe, expect, it } from 'vitest';
import { GridListMessage } from './grid-list.message';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridPnl } from '../../grid-pnl';
import { OrderStats } from '../../order-stats';

function makeGrid(overrides: Partial<GridDto> = {}): GridDto {
    return {
        id: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTC',
        status: GridStatus.Running,
        lowerPrice: 90000,
        upperPrice: 100000,
        levels: 10,
        investmentUSDC: 500,
        investmentBase: 0.001,
        creationPrice: 95000,
        trailingEnabled: false,
        trailingTriggerPercent: 5,
        trailingStepPercent: 2,
        trailingPartialClosePercent: 50,
        stopLossEnabled: false,
        ...overrides,
    };
}

const DEFAULT_PNL: GridPnl = { gridProfit: 5.5, unrealizedPnl: -1.2, totalFees: 0 };
const DEFAULT_ORDER_STATS: OrderStats = {
    activeBuys: 4,
    activeSells: 5,
    avgActiveBuyPrice: 91000,
    avgActiveSellPrice: 96000,
    lowestActiveBuyPrice: 90000,
    highestActiveSellPrice: 100000,
    filledCycles: 3,
};

function makeSnapshot(overrides: Partial<GridSnapshot> = {}): GridSnapshot {
    return {
        grid: makeGrid(),
        pnl: DEFAULT_PNL,
        currentPrice: 95000,
        orderStats: DEFAULT_ORDER_STATS,
        activeOrders: [],
        filledOrders: [],
        ...overrides,
    };
}

describe('GridListMessage', () => {
    const header = '<b>Active Grids</b> (2)';

    it('returns just the header when items are empty', () => {
        const msg = GridListMessage.create(header, [], 0);
        expect(msg.text).toBe(header);
    });

    it('includes header and numbered item lines', () => {
        const items = [makeSnapshot(), makeSnapshot({ grid: makeGrid({ symbol: 'ETH' }) })];
        const msg = GridListMessage.create(header, items, 0);

        expect(msg.text).toContain(header);
        expect(msg.text).toContain('<b>1. BTC/USDC</b>');
        expect(msg.text).toContain('<b>2. ETH/USDC</b>');
        expect(msg.text).toContain('PnL:');
    });

    it('offsets numbering with startIndex', () => {
        const items = [makeSnapshot()];
        const msg = GridListMessage.create(header, items, 5);

        expect(msg.text).toContain('<b>6. BTC/USDC</b>');
        expect(msg.text).not.toContain('<b>1. BTC/USDC</b>');
    });

    it('shows price range and current price', () => {
        const msg = GridListMessage.create(header, [makeSnapshot()], 0);

        expect(msg.text).toContain('$90000');
        expect(msg.text).toContain('$100000');
        expect(msg.text).toContain('$95000');
    });

    it('uses creationPrice for investment when it differs from currentPrice', () => {
        // creationPrice=90000, currentPrice=95000 → investment = 500 + 0.001*90000 = 590
        const snapshot = makeSnapshot({
            grid: makeGrid({ creationPrice: 90000 }),
            currentPrice: 95000,
        });
        const msg = GridListMessage.create(header, [snapshot], 0);

        expect(msg.text).toContain('$590');
        expect(msg.text).not.toContain('$595');
    });

    it('falls back to currentPrice for investment when creationPrice is undefined', () => {
        // creationPrice=undefined, currentPrice=95000 → investment = 500 + 0.001*95000 = 595
        const snapshot = makeSnapshot({
            grid: makeGrid({ creationPrice: undefined }),
            currentPrice: 95000,
        });
        const msg = GridListMessage.create(header, [snapshot], 0);

        expect(msg.text).toContain('$595');
    });
});
