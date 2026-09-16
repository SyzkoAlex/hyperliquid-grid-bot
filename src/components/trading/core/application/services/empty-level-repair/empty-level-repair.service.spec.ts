import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EmptyLevelRepairService } from './empty-level-repair.service';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridsApiPort } from '@components/grids/api/grids-api.port';
import { ExchangePort } from '@components/trading/core/application/ports/exchange.port';
import { ExchangeCloid } from '@components/trading/core/domain/models/exchange-order/exchange-cloid';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { ExchangeOrderStatus } from '@components/trading/core/domain/models/exchange-order/exchange-order-status';
import { Config } from '@/config/config.schema';
import { RefillParams } from '../order-refill/refill-params';
import { PlaceRefillOrderResult } from '../refill-order-placement/place-refill-order-result';
import { RefillOrderPlacementService } from '../refill-order-placement/refill-order-placement.service';

const ACCOUNT_ADDRESS = '0x1234567890123456789012345678901234567890';
const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';
const INTERVAL_MS = 60_000;
const MAX_BACKOFF_MS = 3_600_000;
const NOW = new Date('2026-09-14T12:00:00Z').getTime();
const LONG_AGO = NOW - 10 * INTERVAL_MS;

// Levels 100, 110, ..., 190 (indices 0..9)
const createGrid = (overrides: Partial<GridDto> = {}): GridDto => ({
    id: GRID_ID,
    userId: 'user-1',
    symbol: 'HYPE',
    status: GridStatus.Running,
    lowerPrice: 100,
    upperPrice: 190,
    orderCount: 10,
    investmentUSDC: 1000,
    investmentBase: 10,
    trailingEnabled: false,
    trailingTriggerPercent: 5,
    trailingStepPercent: 2,
    trailingPartialClosePercent: 50,
    stopLossEnabled: false,
    ...overrides,
});

const createOrder = (overrides: Partial<OrderDto>): OrderDto => {
    const orderIndex = overrides.orderIndex ?? 0;
    return {
        id: crypto.randomUUID(),
        gridId: GRID_ID,
        symbol: 'HYPE',
        type: OrderType.Limit,
        side: OrderSide.Buy,
        status: OrderStatus.Placed,
        orderIndex,
        price: 100 + 10 * orderIndex,
        amount: 1.5,
        exchangeOrderId: null,
        createdAt: LONG_AGO,
        ...overrides,
    };
};

const createExchangeOpenOrder = (order: OrderDto): ExchangeOpenOrder => ({
    id: 'exchange-1',
    cloid: ExchangeCloid.create(order.id),
    symbol: TradingSymbol.create(order.symbol),
    type: OrderType.Limit,
    side: order.side,
    price: Price.from(order.price ?? 0),
    amount: Decimal.from(order.amount),
    filledAmount: Decimal.zero(),
    status: ExchangeOrderStatus.OPEN,
    reduceOnly: false,
    placedAt: LONG_AGO,
});

// Every pair except (4, 5) holds an active order: BUYs at 0..3 below, SELLs at 6..9 above
const createOrdersWithEmptyPair4 = (...pairOrders: OrderDto[]): OrderDto[] => [
    ...[0, 1, 2, 3].map((i) => createOrder({ side: OrderSide.Buy, orderIndex: i })),
    ...[6, 7, 8, 9].map((i) => createOrder({ side: OrderSide.Sell, orderIndex: i })),
    ...pairOrders,
];

describe('EmptyLevelRepairService', () => {
    let sut: EmptyLevelRepairService;
    let mockGrids: {
        findOrdersByGridId: ReturnType<typeof vi.fn>;
        findGridById: ReturnType<typeof vi.fn>;
    };
    let mockExchange: { getOrderStatus: ReturnType<typeof vi.fn> };
    let mockRefillPlacement: { placeRefillOrder: ReturnType<typeof vi.fn> };

    const placedParams = (call = 0): RefillParams =>
        mockRefillPlacement.placeRefillOrder.mock.calls[call][1];

    const repair = (
        grid = createGrid(),
        placedOrders: OrderDto[] = [],
        exchangeOpenOrders: ExchangeOpenOrder[] = [],
    ): Promise<number> => sut.repair(grid, placedOrders, exchangeOpenOrders, ACCOUNT_ADDRESS);

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);

        mockGrids = {
            findOrdersByGridId: vi.fn().mockResolvedValue([]),
            findGridById: vi.fn().mockResolvedValue(createGrid()),
        };
        mockExchange = {
            getOrderStatus: vi.fn().mockResolvedValue(null),
        };
        mockRefillPlacement = {
            placeRefillOrder: vi.fn(async (_grid: GridDto, params: RefillParams) =>
                PlaceRefillOrderResult.success(
                    createOrder({
                        side: params.side,
                        orderIndex: params.orderIndex,
                        price: params.price.toNumber(),
                        status: OrderStatus.Pending,
                    }),
                ),
            ),
        };
        const mockConfig = {
            get: () => ({
                emptyLevelRepairIntervalMs: INTERVAL_MS,
                emptyLevelRepairMaxBackoffMs: MAX_BACKOFF_MS,
            }),
        };

        sut = new EmptyLevelRepairService(
            mockGrids as unknown as GridsApiPort,
            mockExchange as unknown as ExchangePort,
            mockRefillPlacement as unknown as RefillOrderPlacementService,
            mockConfig as unknown as ConfigService<Config, true>,
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('places the missing SELL refill when the latest pair order is a filled BUY', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue(
            createOrdersWithEmptyPair4(
                createOrder({ side: OrderSide.Buy, orderIndex: 4, status: OrderStatus.Filled }),
            ),
        );

        const result = await repair();

        expect(result).toBe(1);
        expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledOnce();
        expect(placedParams().side).toBe(OrderSide.Sell);
        expect(placedParams().orderIndex).toBe(5);
        expect(placedParams().price.toNumber()).toBeCloseTo(150);
        expect(placedParams().amount.toNumber()).toBe(1.5);
    });

    it('places the missing BUY refill when the latest pair order is a filled SELL', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue(
            createOrdersWithEmptyPair4(
                createOrder({ side: OrderSide.Sell, orderIndex: 5, status: OrderStatus.Filled }),
            ),
        );

        await repair();

        expect(placedParams().side).toBe(OrderSide.Buy);
        expect(placedParams().orderIndex).toBe(4);
        expect(placedParams().price.toNumber()).toBeCloseTo(140);
    });

    it.each([OrderStatus.Failed, OrderStatus.Cancelled])(
        're-places the same order when the latest pair order is %s',
        async (status) => {
            mockGrids.findOrdersByGridId.mockResolvedValue(
                createOrdersWithEmptyPair4(
                    createOrder({ side: OrderSide.Sell, orderIndex: 5, status, amount: 2 }),
                ),
            );

            const result = await repair();

            expect(result).toBe(1);
            expect(placedParams().side).toBe(OrderSide.Sell);
            expect(placedParams().orderIndex).toBe(5);
            expect(placedParams().price.toNumber()).toBe(150);
            expect(placedParams().amount.toNumber()).toBe(2);
        },
    );

    it.each([OrderStatus.Failed, OrderStatus.Cancelled])(
        'does not re-place a %s order without a price',
        async (status) => {
            mockGrids.findOrdersByGridId.mockResolvedValue(
                createOrdersWithEmptyPair4(
                    createOrder({ side: OrderSide.Sell, orderIndex: 5, status, price: null }),
                ),
            );

            const result = await repair();

            expect(result).toBe(0);
            expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
        },
    );

    it('does not re-place a pair whose failed order is still open on the exchange', async () => {
        const ghostOrder = createOrder({
            side: OrderSide.Buy,
            orderIndex: 4,
            status: OrderStatus.Failed,
        });
        mockGrids.findOrdersByGridId.mockResolvedValue(createOrdersWithEmptyPair4(ghostOrder));

        const result = await repair(createGrid(), [], [createExchangeOpenOrder(ghostOrder)]);

        expect(result).toBe(0);
        expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
    });

    it('does not re-place a failed order that the exchange reports as filled', async () => {
        const ghostOrder = createOrder({
            side: OrderSide.Buy,
            orderIndex: 4,
            status: OrderStatus.Failed,
        });
        mockGrids.findOrdersByGridId.mockResolvedValue(createOrdersWithEmptyPair4(ghostOrder));
        mockExchange.getOrderStatus.mockResolvedValue({
            exchangeOrderId: '111',
            status: ExchangeOrderStatus.FILLED,
            statusTimestamp: LONG_AGO,
        });

        const result = await repair();

        expect(result).toBe(0);
        expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
        expect(mockExchange.getOrderStatus).toHaveBeenCalledWith(
            ACCOUNT_ADDRESS,
            ExchangeCloid.create(ghostOrder.id).toString(),
        );
    });

    it('does not re-place a failed order whose exchange status cannot be read', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue(
            createOrdersWithEmptyPair4(
                createOrder({ side: OrderSide.Buy, orderIndex: 4, status: OrderStatus.Failed }),
            ),
        );
        mockExchange.getOrderStatus.mockRejectedValue(new Error('Network error'));

        const result = await repair();

        expect(result).toBe(0);
        expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
    });

    it('re-places a cancelled order with an exchangeOrderId without looking it up', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue(
            createOrdersWithEmptyPair4(
                createOrder({
                    side: OrderSide.Sell,
                    orderIndex: 5,
                    status: OrderStatus.Cancelled,
                    exchangeOrderId: '111',
                }),
            ),
        );

        const result = await repair();

        expect(result).toBe(1);
        expect(mockExchange.getOrderStatus).not.toHaveBeenCalled();
    });

    it('picks the latest pair order by last activity, not by creation time', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue(
            createOrdersWithEmptyPair4(
                createOrder({
                    side: OrderSide.Sell,
                    orderIndex: 5,
                    status: OrderStatus.Filled,
                    createdAt: LONG_AGO,
                    filledAt: LONG_AGO,
                }),
                createOrder({
                    side: OrderSide.Buy,
                    orderIndex: 4,
                    status: OrderStatus.Filled,
                    createdAt: LONG_AGO - 1000,
                    filledAt: NOW - 2 * INTERVAL_MS,
                }),
            ),
        );

        await repair();

        expect(placedParams().side).toBe(OrderSide.Sell);
        expect(placedParams().orderIndex).toBe(5);
    });

    it('leaves pairs that hold an active order alone', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue(
            createOrdersWithEmptyPair4(
                createOrder({ side: OrderSide.Buy, orderIndex: 4, status: OrderStatus.Filled }),
                createOrder({ side: OrderSide.Sell, orderIndex: 5, status: OrderStatus.Pending }),
            ),
        );

        const result = await repair();

        expect(result).toBe(0);
        expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
    });

    it('skips the order history when every pair holds a placed order', async () => {
        const result = await repair(
            createGrid(),
            createOrdersWithEmptyPair4(createOrder({ side: OrderSide.Buy, orderIndex: 4 })),
        );

        expect(result).toBe(0);
        expect(mockGrids.findOrdersByGridId).not.toHaveBeenCalled();
    });

    it('leaves a pair alone while its latest order changed within the interval', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue(
            createOrdersWithEmptyPair4(
                createOrder({
                    side: OrderSide.Sell,
                    orderIndex: 5,
                    status: OrderStatus.Cancelled,
                    cancelledAt: NOW - 5_000,
                }),
            ),
        );

        const result = await repair();

        expect(result).toBe(0);
        expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
    });

    it('does not re-place a missing order', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue(
            createOrdersWithEmptyPair4(
                createOrder({ side: OrderSide.Buy, orderIndex: 4, status: OrderStatus.Missing }),
            ),
        );

        const result = await repair();

        expect(result).toBe(0);
        expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();
    });

    it('postpones an order that would cross an active opposite-side order and backs off', async () => {
        const grid = createGrid();
        const pairOrders = createOrdersWithEmptyPair4(
            createOrder({ side: OrderSide.Buy, orderIndex: 4, status: OrderStatus.Failed }),
        );
        mockGrids.findOrdersByGridId.mockResolvedValue([
            ...pairOrders,
            createOrder({ side: OrderSide.Sell, orderIndex: 3 }),
        ]);

        const result = await repair(grid);
        expect(result).toBe(0);
        expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();

        mockGrids.findOrdersByGridId.mockResolvedValue(pairOrders);
        vi.setSystemTime(NOW + INTERVAL_MS);
        await repair(grid);
        expect(mockRefillPlacement.placeRefillOrder).not.toHaveBeenCalled();

        vi.setSystemTime(NOW + 2 * INTERVAL_MS);
        await repair(grid);
        expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledOnce();
    });

    it('does nothing for a grid that is not running', async () => {
        const result = await repair(createGrid({ status: GridStatus.Stopped }));

        expect(result).toBe(0);
        expect(mockGrids.findOrdersByGridId).not.toHaveBeenCalled();
    });

    it('forgets the check time of a grid seen not running', async () => {
        await repair();
        await repair(createGrid({ status: GridStatus.Stopped }));
        await repair();

        expect(mockGrids.findOrdersByGridId).toHaveBeenCalledTimes(2);
    });

    it('does not place orders once the grid was stopped after the sync snapshot', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue([
            createOrder({ side: OrderSide.Buy, orderIndex: 0, status: OrderStatus.Filled }),
            createOrder({ side: OrderSide.Sell, orderIndex: 2, status: OrderStatus.Failed }),
        ]);
        mockGrids.findGridById
            .mockResolvedValueOnce(createGrid())
            .mockResolvedValueOnce(createGrid({ status: GridStatus.Stopped }));

        const result = await repair();

        expect(result).toBe(1);
        expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledOnce();
        expect(mockGrids.findGridById).toHaveBeenCalledTimes(2);
    });

    it('checks a grid at most once per interval', async () => {
        const grid = createGrid();

        await repair(grid);
        vi.setSystemTime(NOW + INTERVAL_MS - 1);
        await repair(grid);
        vi.setSystemTime(NOW + INTERVAL_MS);
        await repair(grid);

        expect(mockGrids.findOrdersByGridId).toHaveBeenCalledTimes(2);
    });

    describe('backoff', () => {
        const grid = createGrid();

        beforeEach(() => {
            mockGrids.findOrdersByGridId.mockResolvedValue(
                createOrdersWithEmptyPair4(
                    createOrder({ side: OrderSide.Buy, orderIndex: 4, status: OrderStatus.Failed }),
                ),
            );
            mockRefillPlacement.placeRefillOrder.mockResolvedValue(
                PlaceRefillOrderResult.failure('Insufficient balance'),
            );
        });

        it('backs off exponentially after a failed attempt', async () => {
            await repair(grid);
            vi.setSystemTime(NOW + INTERVAL_MS);
            await repair(grid);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(1);

            vi.setSystemTime(NOW + 2 * INTERVAL_MS);
            await repair(grid);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(2);

            vi.setSystemTime(NOW + 5 * INTERVAL_MS);
            await repair(grid);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(2);

            vi.setSystemTime(NOW + 6 * INTERVAL_MS);
            await repair(grid);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(3);
        });

        it('resets the backoff after a successful repair', async () => {
            await repair(grid);

            mockRefillPlacement.placeRefillOrder.mockResolvedValueOnce(
                PlaceRefillOrderResult.success(createOrder({ status: OrderStatus.Pending })),
            );
            vi.setSystemTime(NOW + 2 * INTERVAL_MS);
            await repair(grid);

            vi.setSystemTime(NOW + 3 * INTERVAL_MS);
            await repair(grid);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(3);

            vi.setSystemTime(NOW + 5 * INTERVAL_MS);
            await repair(grid);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(4);
        });

        it('resets the backoff once the pair holds an active order again', async () => {
            await repair(grid);

            vi.setSystemTime(NOW + INTERVAL_MS);
            await repair(
                grid,
                createOrdersWithEmptyPair4(createOrder({ side: OrderSide.Sell, orderIndex: 5 })),
            );

            vi.setSystemTime(NOW + 2 * INTERVAL_MS);
            await repair(grid);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(2);

            vi.setSystemTime(NOW + 4 * INTERVAL_MS);
            await repair(grid);
            expect(mockRefillPlacement.placeRefillOrder).toHaveBeenCalledTimes(3);
        });
    });

    it('does not throw when placement throws', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue(
            createOrdersWithEmptyPair4(
                createOrder({ side: OrderSide.Buy, orderIndex: 4, status: OrderStatus.Failed }),
            ),
        );
        mockRefillPlacement.placeRefillOrder.mockRejectedValue(new Error('Network error'));

        const result = await repair();

        expect(result).toBe(0);
    });

    it('repairs every empty pair of a drained grid', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue([
            createOrder({ side: OrderSide.Buy, orderIndex: 0, status: OrderStatus.Filled }),
            createOrder({ side: OrderSide.Sell, orderIndex: 2, status: OrderStatus.Failed }),
            createOrder({ side: OrderSide.Sell, orderIndex: 3, status: OrderStatus.Cancelled }),
        ]);

        const result = await repair();

        expect(result).toBe(3);
        expect(
            mockRefillPlacement.placeRefillOrder.mock.calls.map(
                ([, params]) => `${params.side}@${params.orderIndex}`,
            ),
        ).toEqual(['sell@1', 'sell@2', 'sell@3']);
    });

    it('does not place an order crossing one placed earlier in the same check', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue([
            createOrder({ side: OrderSide.Buy, orderIndex: 0, status: OrderStatus.Filled }),
            createOrder({ side: OrderSide.Buy, orderIndex: 1, status: OrderStatus.Failed }),
        ]);

        const result = await repair();

        expect(result).toBe(1);
        expect(placedParams().side).toBe(OrderSide.Sell);
        expect(placedParams().orderIndex).toBe(1);
    });

    it('does not treat an immediately filled order as active for crossing checks', async () => {
        mockGrids.findOrdersByGridId.mockResolvedValue([
            createOrder({ side: OrderSide.Buy, orderIndex: 0, status: OrderStatus.Filled }),
            createOrder({ side: OrderSide.Buy, orderIndex: 1, status: OrderStatus.Failed }),
        ]);
        mockRefillPlacement.placeRefillOrder.mockResolvedValueOnce(
            PlaceRefillOrderResult.immediatelyFilled(
                createOrder({ side: OrderSide.Sell, orderIndex: 1, status: OrderStatus.Filled }),
            ),
        );

        const result = await repair();

        expect(result).toBe(2);
        expect(placedParams(1).side).toBe(OrderSide.Buy);
        expect(placedParams(1).orderIndex).toBe(1);
    });
});
