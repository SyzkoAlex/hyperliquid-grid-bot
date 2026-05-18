import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ActiveGridsViewBuilder } from './active-grids-view-builder.service';
import { GetGridsWithPnlUseCase } from '../../use-cases/get-grids-with-pnl/get-grids-with-pnl.use-case';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridFilter } from '../../use-cases/get-grids-with-pnl/grid-filter';

function makeGrid(id: string, status = GridStatus.Running): GridDto {
    return {
        id,
        symbol: 'BTC',
        status,
        lowerPrice: 90000,
        upperPrice: 100000,
        levels: 10,
        investmentUSDC: 500,
        investmentBase: 0,
        trailingEnabled: false,
        trailingTriggerPercent: 0,
        trailingStepPercent: 0,
        trailingPartialClosePercent: 0,
        stopLossEnabled: false,
    };
}

function makeSnapshot(id: string, status = GridStatus.Running): GridSnapshot {
    return {
        grid: makeGrid(id, status),
        pnl: { gridProfit: 10, unrealizedPnl: -2, totalFees: 0 },
        currentPrice: 95000,
        orderStats: {
            activeBuys: 3,
            activeSells: 4,
            avgActiveBuyPrice: 91000,
            avgActiveSellPrice: 96000,
            lowestActiveBuyPrice: 90000,
            highestActiveSellPrice: 100000,
            filledCycles: 2,
        },
        activeOrders: [],
        filledOrders: [],
    };
}

describe('ActiveGridsViewBuilder', () => {
    let service: ActiveGridsViewBuilder;
    let getGridsWithPnlUseCase: { execute: ReturnType<typeof vi.fn> };
    let configService: ConfigService<any, true>;

    beforeEach(() => {
        getGridsWithPnlUseCase = {
            execute: vi.fn().mockResolvedValue({ items: [], totalCount: 0, currentPage: 1 }),
        };

        configService = {
            get: vi.fn().mockReturnValue({ pagination: { activePageSize: 5 } }),
        } as unknown as ConfigService<any, true>;

        service = new ActiveGridsViewBuilder(
            getGridsWithPnlUseCase as unknown as GetGridsWithPnlUseCase,
            configService,
        );
    });

    describe('build', () => {
        it('should return empty keyboard and header when totalCount is 0', async () => {
            const view = await service.build(1);

            expect(getGridsWithPnlUseCase.execute).toHaveBeenCalledWith(GridFilter.Running, 1, 5);
            expect(view.totalCount).toBe(0);
            expect(view.keyboard).toEqual([]);
            expect(view.text).toContain('No active grids running.');
        });

        it('should include grid symbol in text when grids exist', async () => {
            const items = [makeSnapshot('grid-1'), makeSnapshot('grid-2')];
            getGridsWithPnlUseCase.execute.mockResolvedValue({
                items,
                totalCount: 2,
                currentPage: 1,
            });

            const view = await service.build(1);

            expect(view.totalCount).toBe(2);
            expect(view.text).toContain('BTC/USDC');
            expect(view.keyboard.length).toBeGreaterThan(0);
        });

        it('should use startIndex=5 when on page 2 with pageSize 5', async () => {
            const items = Array.from({ length: 5 }, (_, i) => makeSnapshot(`grid-${i}`));
            getGridsWithPnlUseCase.execute.mockResolvedValue({
                items,
                totalCount: 10,
                currentPage: 2,
            });

            const view = await service.build(2);

            expect(getGridsWithPnlUseCase.execute).toHaveBeenCalledWith(GridFilter.Running, 2, 5);
            expect(view.totalCount).toBe(10);
            // With 10 items and pageSize 5, should have pagination row
            const flatButtons = view.keyboard.flat();
            const paginationButton = flatButtons.find((b) => b.text.includes('/'));
            expect(paginationButton).toBeDefined();
        });
    });
});
