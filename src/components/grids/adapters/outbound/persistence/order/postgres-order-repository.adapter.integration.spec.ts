import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DuplicateActiveOrderError } from '../../../../core/domain/errors/duplicate-active-order.error';
import type { DrizzleDb } from '@/infra/database/drizzle-db';
import { DatabaseTestHelper, TEST_USER_ID } from '@/infra/tests/database-test-helper';
import { Grid } from '../../../../core/domain/models/grid/grid';
import { GridId } from '../../../../core/domain/models/grid/grid-id';
import { Order } from '../../../../core/domain/models/order/order';
import { OrderId } from '../../../../core/domain/models/order/order-id';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { OrderStatus } from '@domain/models/order/order-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { Timestamp } from '@domain/models/primitives/timestamp';
import { PostgresGridRepositoryAdapter } from '../grid/postgres-grid-repository.adapter';
import { PostgresOrderRepositoryAdapter } from './postgres-order-repository.adapter';

function createGrid(id?: GridId): Grid {
    return Grid.create({
        id: id ?? GridId.create(),
        userId: TEST_USER_ID,
        symbol: TradingSymbol.create('HYPE'),
        lowerPrice: Price.from(100),
        upperPrice: Price.from(200),
        levels: 10,
        investmentUSDC: Decimal.from(1000),
        investmentBase: Decimal.from(5),
    });
}

function createOrder(
    overrides: Partial<{
        id: OrderId;
        gridId: GridId;
        exchangeOrderId: string;
        side: OrderSide;
        status: OrderStatus;
        price: number;
        levelIndex: number;
        placedAt: Timestamp;
        filledAt: Timestamp;
        cancelledAt: Timestamp;
    }> = {},
): Order {
    return Order.create({
        id: overrides.id ?? OrderId.create(),
        gridId: overrides.gridId ?? GridId.create(),
        exchangeOrderId: overrides.exchangeOrderId,
        symbol: TradingSymbol.create('HYPE'),
        type: OrderType.Limit,
        side: overrides.side ?? OrderSide.Buy,
        price: overrides.price !== undefined ? Price.from(overrides.price) : Price.from(150),
        amount: Decimal.from(1),
        status: overrides.status ?? OrderStatus.Pending,
        levelIndex: overrides.levelIndex ?? 0,
        placedAt: overrides.placedAt,
        filledAt: overrides.filledAt,
        cancelledAt: overrides.cancelledAt,
    });
}

describe('PostgresOrderRepositoryAdapter (Integration)', () => {
    let db: DrizzleDb;
    let orderRepo: PostgresOrderRepositoryAdapter;
    let gridRepo: PostgresGridRepositoryAdapter;
    let grid: Grid;

    beforeAll(async () => {
        db = await DatabaseTestHelper.initialize();
        orderRepo = new PostgresOrderRepositoryAdapter(db);
        gridRepo = new PostgresGridRepositoryAdapter(db);
    }, 120_000);

    beforeEach(async () => {
        await DatabaseTestHelper.seedTestUser();
        grid = createGrid();
        await gridRepo.save(grid);
    });

    afterEach(async () => {
        await DatabaseTestHelper.cleanup();
    });

    afterAll(async () => {
        await DatabaseTestHelper.close();
    });

    describe('save', () => {
        it('should insert a new order', async () => {
            const order = createOrder({ gridId: grid.id });

            await orderRepo.save(order);

            const found = await orderRepo.findManyByGridId(grid.id);
            expect(found).toHaveLength(1);
            expect(found[0].id.toString()).toBe(order.id.toString());
            expect(found[0].side).toBe(OrderSide.Buy);
            expect(found[0].status).toBe(OrderStatus.Pending);
        });

        it('should preserve all order fields through round-trip', async () => {
            const order = createOrder({
                gridId: grid.id,
                exchangeOrderId: 'EX-123',
                side: OrderSide.Sell,
                price: 175.5,
                levelIndex: 5,
                status: OrderStatus.Placed,
                placedAt: Timestamp.from(new Date('2025-01-15T10:00:00Z')),
            });

            await orderRepo.save(order);

            const found = (await orderRepo.findManyByGridId(grid.id))[0];
            expect(found.exchangeOrderId).toBe('EX-123');
            expect(found.side).toBe(OrderSide.Sell);
            expect(found.price!.toNumber()).toBeCloseTo(175.5, 4);
            expect(found.levelIndex).toBe(5);
            expect(found.status).toBe(OrderStatus.Placed);
        });
    });

    describe('findManyActive', () => {
        it('should return pending and placed orders for grid', async () => {
            const pending = createOrder({
                gridId: grid.id,
                status: OrderStatus.Pending,
                levelIndex: 0,
            });
            const placed = createOrder({
                gridId: grid.id,
                status: OrderStatus.Placed,
                levelIndex: 1,
            });
            const filled = createOrder({
                gridId: grid.id,
                status: OrderStatus.Filled,
                filledAt: Timestamp.now(),
                levelIndex: 2,
            });

            await orderRepo.save(pending);
            await orderRepo.save(placed);
            await orderRepo.save(filled);

            const result = await orderRepo.findManyActive(grid.id);
            expect(result).toHaveLength(2);
            const ids = result.map((o) => o.id.toString());
            expect(ids).toContain(pending.id.toString());
            expect(ids).toContain(placed.id.toString());
        });
    });

    describe('findManyByGridId', () => {
        it('should return all orders for a specific grid', async () => {
            const grid2 = createGrid();
            await gridRepo.save(grid2);

            await orderRepo.save(createOrder({ gridId: grid.id, levelIndex: 0 }));
            await orderRepo.save(createOrder({ gridId: grid.id, levelIndex: 1 }));
            await orderRepo.save(createOrder({ gridId: grid2.id, levelIndex: 0 }));

            const result = await orderRepo.findManyByGridId(grid.id);
            expect(result).toHaveLength(2);
        });
    });

    describe('findOneByExchangeOrderId', () => {
        it('should find order by exchange order ID', async () => {
            const order = createOrder({ gridId: grid.id, exchangeOrderId: 'EX-UNIQUE-42' });
            await orderRepo.save(order);

            const found = await orderRepo.findOneByExchangeOrderId('EX-UNIQUE-42');
            expect(found).not.toBeNull();
            expect(found!.id.toString()).toBe(order.id.toString());
        });

        it('should return null when exchange order ID not found', async () => {
            const found = await orderRepo.findOneByExchangeOrderId('non-existent');
            expect(found).toBeNull();
        });
    });

    describe('updateStatus', () => {
        it('should update order status', async () => {
            const order = createOrder({ gridId: grid.id, status: OrderStatus.Pending });
            await orderRepo.save(order);

            await orderRepo.updateStatus(order.id.toString(), OrderStatus.Placed);

            const found = (await orderRepo.findManyByGridId(grid.id))[0];
            expect(found.status).toBe(OrderStatus.Placed);
        });

        it('should set filledAt when marking as filled', async () => {
            const order = createOrder({ gridId: grid.id, status: OrderStatus.Placed });
            await orderRepo.save(order);
            const filledAt = new Date('2025-06-15T12:00:00Z');

            await orderRepo.updateStatus(order.id.toString(), OrderStatus.Filled, filledAt);

            const found = (await orderRepo.findManyByGridId(grid.id))[0];
            expect(found.status).toBe(OrderStatus.Filled);
            expect(found.filledAt).not.toBeNull();
        });

        it('should set cancelledAt when marking as cancelled', async () => {
            const order = createOrder({ gridId: grid.id, status: OrderStatus.Placed });
            await orderRepo.save(order);

            await orderRepo.updateStatus(order.id.toString(), OrderStatus.Cancelled);

            const found = (await orderRepo.findManyByGridId(grid.id))[0];
            expect(found.status).toBe(OrderStatus.Cancelled);
            expect(found.cancelledAt).not.toBeNull();
        });
    });

    describe('updateExchangeOrderId', () => {
        it('should update exchange order ID, status, and placedAt', async () => {
            const order = createOrder({ gridId: grid.id, status: OrderStatus.Pending });
            await orderRepo.save(order);
            const placedAt = new Date('2025-03-10T08:00:00Z');

            await orderRepo.updateExchangeOrderId(
                order.id.toString(),
                'EX-PLACED-99',
                OrderStatus.Placed,
                placedAt,
            );

            const found = await orderRepo.findOneByExchangeOrderId('EX-PLACED-99');
            expect(found).not.toBeNull();
            expect(found!.status).toBe(OrderStatus.Placed);
            expect(found!.placedAt).not.toBeNull();
        });
    });

    describe('findManyByStatus', () => {
        it('should return orders filtered by status', async () => {
            await orderRepo.save(
                createOrder({ gridId: grid.id, status: OrderStatus.Pending, levelIndex: 0 }),
            );
            await orderRepo.save(
                createOrder({ gridId: grid.id, status: OrderStatus.Placed, levelIndex: 1 }),
            );
            await orderRepo.save(
                createOrder({ gridId: grid.id, status: OrderStatus.Pending, levelIndex: 2 }),
            );

            const result = await orderRepo.findManyByStatus(OrderStatus.Pending);
            expect(result).toHaveLength(2);
        });
    });

    describe('findManyByGridIds', () => {
        it('should return orders for multiple grids', async () => {
            const grid2 = createGrid();
            await gridRepo.save(grid2);

            await orderRepo.save(createOrder({ gridId: grid.id }));
            await orderRepo.save(createOrder({ gridId: grid2.id }));

            const result = await orderRepo.findManyByGridIds([
                grid.id.toString(),
                grid2.id.toString(),
            ]);
            expect(result).toHaveLength(2);
        });

        it('should return empty array for empty input', async () => {
            const result = await orderRepo.findManyByGridIds([]);
            expect(result).toEqual([]);
        });
    });

    describe('partial unique index (idx_orders_active_level)', () => {
        it('should throw DuplicateActiveOrderError when saving duplicate active order at same level', async () => {
            const order1 = createOrder({
                gridId: grid.id,
                levelIndex: 3,
                side: OrderSide.Buy,
                status: OrderStatus.Pending,
            });
            await orderRepo.save(order1);

            const order2 = createOrder({
                gridId: grid.id,
                levelIndex: 3,
                side: OrderSide.Buy,
                status: OrderStatus.Pending,
            });
            await expect(orderRepo.save(order2)).rejects.toThrow(DuplicateActiveOrderError);
        });

        it('should allow saving order at same level after first is filled', async () => {
            const order1 = createOrder({
                gridId: grid.id,
                levelIndex: 3,
                side: OrderSide.Buy,
                status: OrderStatus.Pending,
            });
            await orderRepo.save(order1);
            await orderRepo.updateStatus(order1.id.toString(), OrderStatus.Filled, new Date());

            const order2 = createOrder({
                gridId: grid.id,
                levelIndex: 3,
                side: OrderSide.Buy,
                status: OrderStatus.Pending,
            });
            await expect(orderRepo.save(order2)).resolves.not.toThrow();
        });

        it('should allow saving orders at same level with different sides', async () => {
            const buyOrder = createOrder({
                gridId: grid.id,
                levelIndex: 3,
                side: OrderSide.Buy,
                status: OrderStatus.Pending,
            });
            const sellOrder = createOrder({
                gridId: grid.id,
                levelIndex: 3,
                side: OrderSide.Sell,
                status: OrderStatus.Pending,
            });
            await orderRepo.save(buyOrder);
            await expect(orderRepo.save(sellOrder)).resolves.not.toThrow();
        });
    });

    describe('findManyPlacedByGridIds', () => {
        it('should return pending and placed orders for multiple grids', async () => {
            const grid2 = createGrid();
            await gridRepo.save(grid2);

            await orderRepo.save(
                createOrder({ gridId: grid.id, status: OrderStatus.Pending, levelIndex: 0 }),
            );
            await orderRepo.save(
                createOrder({ gridId: grid.id, status: OrderStatus.Placed, levelIndex: 1 }),
            );
            await orderRepo.save(
                createOrder({
                    gridId: grid.id,
                    status: OrderStatus.Filled,
                    filledAt: Timestamp.now(),
                    levelIndex: 2,
                }),
            );
            await orderRepo.save(
                createOrder({ gridId: grid2.id, status: OrderStatus.Placed, levelIndex: 0 }),
            );

            const result = await orderRepo.findManyPlacedByGridIds([
                grid.id.toString(),
                grid2.id.toString(),
            ]);
            expect(result).toHaveLength(3);
        });

        it('should return empty array for empty input', async () => {
            const result = await orderRepo.findManyPlacedByGridIds([]);
            expect(result).toEqual([]);
        });
    });
});
