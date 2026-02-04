import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncOrdersUseCase } from './sync-orders.use-case';
import { GridMode } from '../../domain/grid/grid-mode';
import { Grid } from '../../domain/grid/grid';
import { Symbol } from '../../domain/common/symbol';
import { Price } from '../../domain/common/price';
import { Decimal } from '../../../../../domain/primitives/decimal';
import { Order } from '../../domain/order/order';
import { OrderId } from '../../domain/order/order-id';
import { OrderType } from '../../domain/order/order-type';
import { OrderSide } from '../../domain/order/order-side';
import { OrderStatus } from '../../domain/order/order-status';
import { ExchangeCloid } from '../../domain/exchange-order/exchange-cloid';
import { ExchangeOrderStatus } from '../../domain/exchange-order/exchange-order-status';

describe('SyncOrdersUseCase', () => {
    let useCase: SyncOrdersUseCase;
    let mockOrderClient: any;
    let mockGridRepository: any;
    let mockOrderRepository: any;
    let mockOrderStatusSyncService: any;
    let mockOrderRefillService: any;
    let mockConfigService: any;

    const createTestGrid = () => {
        return Grid.create({
            symbol: Symbol.create('BTC'),
            mode: GridMode.Neutral,
            lowerPrice: Price.from(45000),
            upperPrice: Price.from(55000),
            levels: 11,
            investmentUSDC: Decimal.from(5000),
            investmentBase: Decimal.from(0.1),
        });
    };

    beforeEach(() => {
        mockOrderClient = {
            getOpenSpotOrders: vi.fn().mockResolvedValue([]),
        };

        mockGridRepository = {
            findManyActive: vi.fn().mockResolvedValue([]),
            findManyActiveByIds: vi.fn().mockResolvedValue([]),
        };

        mockOrderRepository = {
            findManyPendingByGridId: vi.fn().mockResolvedValue([]),
            findManyByIds: vi.fn().mockResolvedValue([]),
            findManyPlacedByGridIds: vi.fn().mockResolvedValue([]),
        };

        mockOrderStatusSyncService = {
            process: vi.fn().mockResolvedValue({ filled: 0, filledOrders: [] }),
        };

        mockOrderRefillService = {
            process: vi.fn().mockResolvedValue({ success: false }),
        };

        mockConfigService = {
            get: vi.fn().mockReturnValue({ accountAddress: '0x123' }),
        };

        useCase = new SyncOrdersUseCase(
            mockConfigService,
            mockOrderClient,
            mockGridRepository,
            mockOrderRepository,
            mockOrderStatusSyncService,
            mockOrderRefillService,
        );
    });

    describe('execute', () => {
        it('should return empty result when no active grids', async () => {
            mockOrderClient.getOpenSpotOrders.mockResolvedValue([]);
            mockGridRepository.findManyActive.mockResolvedValue([]);

            const result = await useCase.execute();

            expect(result.gridsProcessed).toBe(0);
            expect(result.fillsDetected).toBe(0);
            expect(mockOrderClient.getOpenSpotOrders).toHaveBeenCalledWith('0x123');
            expect(mockGridRepository.findManyActive).toHaveBeenCalled();
        });

        it('should process active grids and detect fills', async () => {
            const grid = createTestGrid();
            grid.start();

            const orderId = OrderId.create();
            const cloid = ExchangeCloid.create(orderId);

            const order = Order.create({
                id: orderId,
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: grid.id,
                levelIndex: 5,
            });

            const exchangeOrder = {
                id: 'exchange-123',
                cloid,
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                filledAmount: Decimal.zero(),
                status: ExchangeOrderStatus.OPEN,
                reduceOnly: false,
                placedAt: Date.now(),
            };

            mockOrderClient.getOpenSpotOrders.mockResolvedValue([exchangeOrder]);
            mockGridRepository.findManyActive.mockResolvedValue([grid]);
            mockOrderRepository.findManyPlacedByGridIds.mockResolvedValue([order]);
            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 1,
                filledOrders: [order],
            });
            mockOrderRefillService.process.mockResolvedValue({ success: true });

            const result = await useCase.execute();

            expect(result.gridsProcessed).toBe(1);
            expect(result.fillsDetected).toBe(1);
            expect(result.refillsPlaced).toBe(1);
            expect(mockOrderStatusSyncService.process).toHaveBeenCalledWith(
                [order],
                [exchangeOrder],
            );
            expect(mockOrderRefillService.process).toHaveBeenCalledWith(order, grid);
        });

        it('should skip grids that are not running', async () => {
            const grid = createTestGrid();
            // Grid is in Idle state (not started)

            const orderId = OrderId.create();
            const cloid = ExchangeCloid.create(orderId);

            const order = Order.create({
                id: orderId,
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: grid.id,
                levelIndex: 5,
            });

            const exchangeOrder = {
                id: 'exchange-123',
                cloid,
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                filledAmount: Decimal.zero(),
                status: ExchangeOrderStatus.OPEN,
                reduceOnly: false,
                placedAt: Date.now(),
            };

            mockOrderClient.getOpenSpotOrders.mockResolvedValue([exchangeOrder]);
            mockGridRepository.findManyActive.mockResolvedValue([grid]);
            mockOrderRepository.findManyPlacedByGridIds.mockResolvedValue([order]);

            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 0,
                filledOrders: [],
            });

            const result = await useCase.execute();

            expect(result.gridsProcessed).toBe(1);
            expect(result.fillsDetected).toBe(0);
            expect(mockOrderStatusSyncService.process).toHaveBeenCalledWith(
                [order],
                [exchangeOrder],
            );
        });

        it('should handle errors gracefully and continue processing', async () => {
            const grid1 = createTestGrid();
            const grid2 = createTestGrid();
            grid1.start();
            grid2.start();

            const orderId1 = OrderId.create();
            const orderId2 = OrderId.create();
            const cloid1 = ExchangeCloid.create(orderId1);
            const cloid2 = ExchangeCloid.create(orderId2);

            const order1 = Order.create({
                id: orderId1,
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: grid1.id,
                levelIndex: 5,
            });

            const order2 = Order.create({
                id: orderId2,
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: grid2.id,
                levelIndex: 5,
            });

            const exchangeOrder1 = {
                id: 'exchange-123',
                cloid: cloid1,
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                filledAmount: Decimal.zero(),
                status: ExchangeOrderStatus.OPEN,
                reduceOnly: false,
                placedAt: Date.now(),
            };

            const exchangeOrder2 = {
                id: 'exchange-456',
                cloid: cloid2,
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                filledAmount: Decimal.zero(),
                status: ExchangeOrderStatus.OPEN,
                reduceOnly: false,
                placedAt: Date.now(),
            };

            mockOrderClient.getOpenSpotOrders.mockResolvedValue([exchangeOrder1, exchangeOrder2]);
            mockGridRepository.findManyActive.mockResolvedValue([grid1, grid2]);
            mockOrderRepository.findManyPlacedByGridIds.mockResolvedValue([order1, order2]);
            mockOrderStatusSyncService.process
                .mockRejectedValueOnce(new Error('DB error'))
                .mockResolvedValueOnce({ filled: 0, filledOrders: [] });

            const result = await useCase.execute();

            expect(result.gridsProcessed).toBe(1); // Only second grid processed
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('DB error');
        });

        it('should count refills correctly', async () => {
            const grid = createTestGrid();
            grid.start();

            const orderId = OrderId.create();
            const cloid = ExchangeCloid.create(orderId);

            const order = Order.create({
                id: orderId,
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: grid.id,
                levelIndex: 5,
            });

            const exchangeOrder = {
                id: 'exchange-123',
                cloid,
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                filledAmount: Decimal.zero(),
                status: ExchangeOrderStatus.OPEN,
                reduceOnly: false,
                placedAt: Date.now(),
            };

            const order2 = Order.create({
                id: OrderId.create(),
                symbol: Symbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: grid.id,
                levelIndex: 6,
            });

            mockOrderClient.getOpenSpotOrders.mockResolvedValue([exchangeOrder]);
            mockGridRepository.findManyActive.mockResolvedValue([grid]);
            mockOrderRepository.findManyPlacedByGridIds.mockResolvedValue([order, order2]);

            mockOrderStatusSyncService.process.mockResolvedValue({
                filled: 2,
                filledOrders: [order, order2],
            });
            mockOrderRefillService.process
                .mockResolvedValueOnce({ success: true })
                .mockResolvedValueOnce({ success: false });

            const result = await useCase.execute();

            expect(result.fillsDetected).toBe(2);
            expect(result.refillsPlaced).toBe(1); // Only one successful
        });
    });
});
