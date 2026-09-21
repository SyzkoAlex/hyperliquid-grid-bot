import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GridsApiAdapter } from './grids-api.adapter';
import { Grid } from '../core/domain/models/grid/grid';
import { GridId } from '../core/domain/models/grid/grid-id';
import { Order } from '../core/domain/models/order/order';
import { OrderId } from '../core/domain/models/order/order-id';
import { GridRepositoryPort } from '../core/application/ports/grid-repository.port';
import { OrderRepositoryPort } from '../core/application/ports/order-repository.port';
import { GridSnapshotFactory } from '../core/application/services/grid-snapshot-factory/grid-snapshot.factory';
import { GridsApiMapper } from './grids-api.mapper';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';

const USER_ID = 'user-1';

function makeGrid(symbol = 'BTC'): Grid {
    return Grid.create({
        id: GridId.create(),
        userId: USER_ID,
        symbol: TradingSymbol.create(symbol),
        lowerPrice: Price.from(90),
        upperPrice: Price.from(110),
        orderCount: 10,
        investmentUSDC: Decimal.from(500),
        investmentBase: Decimal.from(0),
    });
}

function makeOrder(gridId: GridId): Order {
    return Order.create({
        id: OrderId.create(),
        gridId,
        symbol: TradingSymbol.create('BTC'),
        type: OrderType.Limit,
        side: OrderSide.Buy,
        price: Price.from(95),
        amount: Decimal.from(1),
        status: OrderStatus.Placed,
        orderIndex: 0,
    });
}

describe('GridsApiAdapter', () => {
    let gridRepo: {
        findOneByIdAndUserId: ReturnType<typeof vi.fn>;
        countByUserIdAndStatus: ReturnType<typeof vi.fn>;
        findManyByUserIdAndStatusPaged: ReturnType<typeof vi.fn>;
    };
    let orderRepo: { findManyByGridIds: ReturnType<typeof vi.fn> };
    let snapshotFactory: { create: ReturnType<typeof vi.fn> };
    let sut: GridsApiAdapter;

    beforeEach(() => {
        gridRepo = {
            findOneByIdAndUserId: vi.fn().mockResolvedValue(null),
            countByUserIdAndStatus: vi.fn().mockResolvedValue(0),
            findManyByUserIdAndStatusPaged: vi.fn().mockResolvedValue([]),
        };
        orderRepo = { findManyByGridIds: vi.fn().mockResolvedValue([]) };
        snapshotFactory = {
            create: vi.fn((grid, orders, currentPrice) => ({ grid, orders, currentPrice })),
        };
        sut = new GridsApiAdapter(
            gridRepo as unknown as GridRepositoryPort,
            orderRepo as unknown as OrderRepositoryPort,
            snapshotFactory as unknown as GridSnapshotFactory,
        );
    });

    describe('findGridByIdForUser', () => {
        it('forwards the id and userId to the owner-scoped query', async () => {
            const grid = makeGrid();
            gridRepo.findOneByIdAndUserId.mockResolvedValue(grid);

            const result = await sut.findGridByIdForUser(USER_ID, grid.id.toString());

            const [id, userId] = gridRepo.findOneByIdAndUserId.mock.calls[0];
            expect(id.toString()).toBe(grid.id.toString());
            expect(userId).toBe(USER_ID);
            expect(result).toEqual(GridsApiMapper.toGridDto(grid));
        });

        it('returns null when the scoped query finds nothing', async () => {
            const result = await sut.findGridByIdForUser(USER_ID, GridId.create().toString());

            expect(result).toBeNull();
        });
    });

    describe('findGridsPagedForUser', () => {
        it('forwards userId and status to the count and page queries', async () => {
            const grid = makeGrid();
            gridRepo.countByUserIdAndStatus.mockResolvedValue(25);
            gridRepo.findManyByUserIdAndStatusPaged.mockResolvedValue([grid]);

            const result = await sut.findGridsPagedForUser({
                userId: USER_ID,
                status: GridStatus.Running,
                page: 2,
                pageSize: 10,
            });

            expect(gridRepo.countByUserIdAndStatus).toHaveBeenCalledWith(
                USER_ID,
                GridStatus.Running,
            );
            expect(gridRepo.findManyByUserIdAndStatusPaged).toHaveBeenCalledWith(
                USER_ID,
                GridStatus.Running,
                10,
                10,
            );
            expect(result).toEqual({
                items: [GridsApiMapper.toGridDto(grid)],
                totalCount: 25,
                currentPage: 2,
            });
        });

        it('clamps a page beyond the last one to the last page', async () => {
            gridRepo.countByUserIdAndStatus.mockResolvedValue(25);

            const result = await sut.findGridsPagedForUser({
                userId: USER_ID,
                page: 99,
                pageSize: 10,
            });

            expect(result.currentPage).toBe(3);
            expect(gridRepo.findManyByUserIdAndStatusPaged).toHaveBeenCalledWith(
                USER_ID,
                undefined,
                20,
                10,
            );
        });

        it('clamps a page below 1 to the first page', async () => {
            gridRepo.countByUserIdAndStatus.mockResolvedValue(25);

            const result = await sut.findGridsPagedForUser({
                userId: USER_ID,
                page: 0,
                pageSize: 10,
            });

            expect(result.currentPage).toBe(1);
            expect(gridRepo.findManyByUserIdAndStatusPaged).toHaveBeenCalledWith(
                USER_ID,
                undefined,
                0,
                10,
            );
        });

        it('returns page 1 with offset 0 when the user has no grids', async () => {
            const result = await sut.findGridsPagedForUser({
                userId: USER_ID,
                page: 3,
                pageSize: 10,
            });

            expect(result).toEqual({ items: [], totalCount: 0, currentPage: 1 });
            expect(gridRepo.findManyByUserIdAndStatusPaged).toHaveBeenCalledWith(
                USER_ID,
                undefined,
                0,
                10,
            );
        });
    });

    describe('buildGridSnapshots', () => {
        it('builds one snapshot per grid with its own orders and the price at the matching index', async () => {
            const btc = GridsApiMapper.toGridDto(makeGrid('BTC'));
            const eth = GridsApiMapper.toGridDto(makeGrid('ETH'));
            const btcOrder = makeOrder(GridId.from(btc.id));
            const ethOrder = makeOrder(GridId.from(eth.id));
            orderRepo.findManyByGridIds.mockResolvedValue([ethOrder, btcOrder]);

            const result = await sut.buildGridSnapshots([btc, eth], [100, 3]);

            expect(orderRepo.findManyByGridIds).toHaveBeenCalledWith([btc.id, eth.id]);
            expect(snapshotFactory.create).toHaveBeenCalledWith(
                btc,
                [GridsApiMapper.toOrderDto(btcOrder)],
                100,
            );
            expect(snapshotFactory.create).toHaveBeenCalledWith(
                eth,
                [GridsApiMapper.toOrderDto(ethOrder)],
                3,
            );
            expect(result).toHaveLength(2);
        });

        it('passes an empty order list for a grid without orders', async () => {
            const grid = GridsApiMapper.toGridDto(makeGrid());

            await sut.buildGridSnapshots([grid], [100]);

            expect(snapshotFactory.create).toHaveBeenCalledWith(grid, [], 100);
        });
    });
});
