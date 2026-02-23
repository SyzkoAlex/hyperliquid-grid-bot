import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresOrderRepositoryAdapter } from './postgres-order-repository.adapter';
import { Order } from '@domain/models/order/order';
import { OrderId } from '@domain/models/order/order-id';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { DatabaseTestHelper } from '@adapters/outbound/database/database-test-helper';
import { orders } from '@adapters/outbound/database/schema';
import { eq } from 'drizzle-orm';
import { Grid } from '@domain/models/grid/grid';
import { GridMode } from '@domain/models/grid/grid-mode';
import { PostgresGridRepositoryAdapter } from '../grid/postgres-grid-repository.adapter';

/**
 * Integration Tests for PostgresOrderRepositoryAdapter with Testcontainers
 *
 * These tests use Testcontainers to automatically manage PostgreSQL Docker container.
 * No manual setup required - container is created and destroyed automatically.
 *
 * Run with: pnpm test:integration
 */
describe('PostgresOrderRepositoryAdapter (Integration)', () => {
    let repository: PostgresOrderRepositoryAdapter;
    let gridRepository: PostgresGridRepositoryAdapter;
    let testGrid: Grid;
    const createdOrderIds: string[] = [];

    beforeAll(async () => {
        // Initialize testcontainer
        const db = await DatabaseTestHelper.initialize();

        // Create repositories
        repository = new PostgresOrderRepositoryAdapter(db);
        gridRepository = new PostgresGridRepositoryAdapter(db);

        console.log('🧪 PostgresOrderRepositoryAdapter test setup complete');
        console.log('🔗 Database connection:', DatabaseTestHelper.getConnectionUri());
    });

    beforeEach(async () => {
        // Create a test grid that will be used for orders in each test
        testGrid = Grid.create({
            symbol: TradingSymbol.create('BTC'),
            mode: GridMode.Neutral,
            lowerPrice: Price.from(45000),
            upperPrice: Price.from(55000),
            levels: 11,
            investmentUSDC: Decimal.from(5000),
            investmentBase: Decimal.from(0.1),
            trailingEnabled: false,
            trailingTriggerPercent: 5,
            trailingStepPercent: 10,
            trailingPartialClosePercent: 50,
        });
        testGrid.start();
        await gridRepository.save(testGrid);
    });

    afterEach(async () => {
        // Cleanup: Delete test orders
        if (createdOrderIds.length > 0) {
            const db = DatabaseTestHelper.getDb();
            for (const orderId of createdOrderIds) {
                await db.delete(orders).where(eq(orders.id, orderId));
            }
            createdOrderIds.length = 0;
            console.log('🗑️  Test orders cleaned up');
        }
    });

    afterAll(async () => {
        // Stop testcontainer
        await DatabaseTestHelper.close();
    });

    describe('save', () => {
        it('should save a new order to database', async () => {
            const orderId = OrderId.create();
            const gridId = testGrid.id;
            const order = Order.create({
                id: orderId,
                exchangeOrderId: 'exchange-123',
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: gridId,
                levelIndex: 5,
            });

            createdOrderIds.push(order.id.toString());

            await repository.save(order);

            // Verify order was saved
            const savedOrder = await repository.findOneByExchangeOrderId(order.exchangeOrderId!);

            expect(savedOrder).toBeDefined();
            expect(savedOrder).not.toBeNull();
            if (!savedOrder) throw new Error('savedOrder is null');

            expect(savedOrder.id.toString()).toBe(order.id.toString());
            expect(savedOrder.exchangeOrderId).toBe('exchange-123');
            expect(savedOrder.symbol.toString()).toBe('BTC');
            expect(savedOrder.side).toBe(OrderSide.Buy);
            expect(savedOrder.price).not.toBeNull();
            expect(savedOrder.price!.toNumber()).toBe(50000);
            expect(savedOrder.amount.toNumber()).toBe(0.01);
            expect(savedOrder.status).toBe(OrderStatus.Placed);
            expect(savedOrder.gridId.equals(gridId)).toBe(true);
            expect(savedOrder.levelIndex).toBe(5);

            console.log('✅ Order saved:', order.id.toString());
        });

        it('should save order with pending status', async () => {
            const orderId = OrderId.create();
            const gridId = testGrid.id;
            const order = Order.create({
                id: orderId,
                exchangeOrderId: undefined,
                symbol: TradingSymbol.create('ETH'),
                type: OrderType.Limit,
                side: OrderSide.Sell,
                price: Price.from(3000),
                amount: Decimal.from(0.5),
                status: OrderStatus.Pending,
                gridId: gridId,
                levelIndex: 3,
            });

            createdOrderIds.push(order.id.toString());

            await repository.save(order);

            const savedOrders = await repository.findManyByStatus(OrderStatus.Pending);
            const savedOrder = savedOrders.find((o) => o.id.toString() === order.id.toString());

            expect(savedOrder).toBeDefined();
            expect(savedOrder!.status).toBe(OrderStatus.Pending);
            expect(savedOrder!.exchangeOrderId).toBeFalsy();

            console.log('✅ Pending order saved');
        });
    });

    describe('findManyActive', () => {
        it('should find active orders for a grid', async () => {
            const gridId = testGrid.id;

            // Create pending order
            const pendingOrder = Order.create({
                id: OrderId.create(),
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(49000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Pending,
                gridId: gridId,
                levelIndex: 4,
            });

            // Create placed order
            const placedOrder = Order.create({
                id: OrderId.create(),
                exchangeOrderId: 'exchange-placed',
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Sell,
                price: Price.from(51000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: gridId,
                levelIndex: 6,
            });

            // Create filled order (should not be returned)
            const filledOrder = Order.create({
                id: OrderId.create(),
                exchangeOrderId: 'exchange-filled',
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Filled,
                gridId: gridId,
                levelIndex: 5,
            });

            createdOrderIds.push(
                pendingOrder.id.toString(),
                placedOrder.id.toString(),
                filledOrder.id.toString(),
            );

            await repository.save(pendingOrder);
            await repository.save(placedOrder);
            await repository.save(filledOrder);

            const activeOrders = await repository.findManyActive(gridId);

            expect(activeOrders.length).toBe(2);
            expect(activeOrders.some((o) => o.status === OrderStatus.Pending)).toBe(true);
            expect(activeOrders.some((o) => o.status === OrderStatus.Placed)).toBe(true);
            expect(activeOrders.every((o) => o.gridId.equals(gridId))).toBe(true);

            console.log('✅ Active orders found:', activeOrders.length);
        });

        it('should return empty array when no active orders', async () => {
            const gridId = testGrid.id;
            const activeOrders = await repository.findManyActive(gridId);

            expect(activeOrders).toBeInstanceOf(Array);
            expect(activeOrders.length).toBe(0);

            console.log('✅ Returns empty array for grid without active orders');
        });
    });

    describe('findOneByExchangeOrderId', () => {
        it('should find order by exchange order id', async () => {
            const gridId = testGrid.id;
            const order = Order.create({
                id: OrderId.create(),
                exchangeOrderId: 'unique-exchange-id',
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: gridId,
                levelIndex: 5,
            });

            createdOrderIds.push(order.id.toString());
            await repository.save(order);

            const foundOrder = await repository.findOneByExchangeOrderId('unique-exchange-id');

            expect(foundOrder).toBeDefined();
            expect(foundOrder!.id.toString()).toBe(order.id.toString());
            expect(foundOrder!.exchangeOrderId).toBe('unique-exchange-id');

            console.log('✅ Order found by exchange ID');
        });

        it('should return null for non-existent exchange order id', async () => {
            const foundOrder = await repository.findOneByExchangeOrderId('non-existent-id');

            expect(foundOrder).toBeNull();

            console.log('✅ Returns null for non-existent exchange order ID');
        });
    });

    describe('updateStatus', () => {
        it('should update order status to filled', async () => {
            const gridId = testGrid.id;
            const order = Order.create({
                id: OrderId.create(),
                exchangeOrderId: 'exchange-to-fill',
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: gridId,
                levelIndex: 5,
            });

            createdOrderIds.push(order.id.toString());
            await repository.save(order);

            const fillTime = new Date();
            await repository.updateStatus(order.id.toString(), OrderStatus.Filled, fillTime);

            const updatedOrder = await repository.findOneByExchangeOrderId('exchange-to-fill');

            expect(updatedOrder!.status).toBe(OrderStatus.Filled);

            console.log('✅ Order status updated to filled');
        });

        it('should update order status to cancelled', async () => {
            const gridId = testGrid.id;
            const order = Order.create({
                id: OrderId.create(),
                exchangeOrderId: 'exchange-to-cancel',
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Placed,
                gridId: gridId,
                levelIndex: 5,
            });

            createdOrderIds.push(order.id.toString());
            await repository.save(order);

            await repository.updateStatus(order.id.toString(), OrderStatus.Cancelled);

            const updatedOrder = await repository.findOneByExchangeOrderId('exchange-to-cancel');

            expect(updatedOrder!.status).toBe(OrderStatus.Cancelled);

            console.log('✅ Order status updated to cancelled');
        });
    });

    describe('updateExchangeOrderId', () => {
        it('should update exchange order id after placement', async () => {
            const orderId = OrderId.create();
            const gridId = testGrid.id;
            const order = Order.create({
                id: orderId,
                exchangeOrderId: undefined,
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Pending,
                gridId: gridId,
                levelIndex: 5,
            });

            createdOrderIds.push(order.id.toString());
            await repository.save(order);

            const placedAt = new Date();
            await repository.updateExchangeOrderId(
                order.id.toString(),
                'new-exchange-id',
                OrderStatus.Placed,
                placedAt,
            );

            const updatedOrder = await repository.findOneByExchangeOrderId('new-exchange-id');

            expect(updatedOrder).toBeDefined();
            expect(updatedOrder!.id.toString()).toBe(order.id.toString());
            expect(updatedOrder!.exchangeOrderId).toBe('new-exchange-id');
            expect(updatedOrder!.status).toBe(OrderStatus.Placed);

            console.log('✅ Exchange order ID updated');
        });
    });

    describe('findManyPendingByGridId', () => {
        it('should find pending orders for a grid', async () => {
            const gridId = testGrid.id;

            const pendingOrder = Order.create({
                id: OrderId.create(),
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Pending,
                gridId: gridId,
                levelIndex: 5,
            });

            createdOrderIds.push(pendingOrder.id.toString());
            await repository.save(pendingOrder);

            const pendingOrders = await repository.findManyPendingByGridId(gridId.toString());

            expect(pendingOrders.length).toBeGreaterThan(0);
            expect(pendingOrders.every((o) => o.status === OrderStatus.Pending)).toBe(true);
            expect(pendingOrders.every((o) => o.gridId.equals(gridId))).toBe(true);

            console.log('✅ Pending orders found for grid');
        });
    });

    describe('findManyStalePending', () => {
        it('should find stale pending orders older than threshold', async () => {
            const gridId = testGrid.id;
            const staleOrder = Order.create({
                id: OrderId.create(),
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Pending,
                gridId: gridId,
                levelIndex: 5,
            });

            createdOrderIds.push(staleOrder.id.toString());
            await repository.save(staleOrder);

            // Query for orders older than future date (should include our order)
            const futureDate = new Date(Date.now() + 60000);
            const staleOrders = await repository.findManyStalePending(futureDate);

            expect(staleOrders.some((o) => o.id.toString() === staleOrder.id.toString())).toBe(
                true,
            );
            expect(staleOrders.every((o) => o.status === OrderStatus.Pending)).toBe(true);

            console.log('✅ Stale pending orders found');
        });
    });

    describe('findManyByStatus', () => {
        it('should find all orders with specific status', async () => {
            const gridId = testGrid.id;
            const filledOrder = Order.create({
                id: OrderId.create(),
                exchangeOrderId: 'exchange-filled-1',
                symbol: TradingSymbol.create('BTC'),
                type: OrderType.Limit,
                side: OrderSide.Buy,
                price: Price.from(50000),
                amount: Decimal.from(0.01),
                status: OrderStatus.Filled,
                gridId: gridId,
                levelIndex: 5,
            });

            createdOrderIds.push(filledOrder.id.toString());
            await repository.save(filledOrder);

            const filledOrders = await repository.findManyByStatus(OrderStatus.Filled);

            expect(filledOrders.some((o) => o.id.toString() === filledOrder.id.toString())).toBe(
                true,
            );
            expect(filledOrders.every((o) => o.status === OrderStatus.Filled)).toBe(true);

            console.log('✅ Orders found by status');
        });
    });

    describe('domain mapping', () => {
        it('should correctly map domain object to database and back', async () => {
            const orderId = OrderId.create();
            const gridId = testGrid.id;

            const originalOrder = Order.create({
                id: orderId,
                exchangeOrderId: 'exchange-mapping-test',
                symbol: TradingSymbol.create('SOL'),
                type: OrderType.Limit,
                side: OrderSide.Sell,
                price: Price.from(125.5),
                amount: Decimal.from(10),
                status: OrderStatus.Placed,
                gridId: gridId,
                levelIndex: 7,
            });

            await repository.save(originalOrder);
            createdOrderIds.push(originalOrder.id.toString());

            const retrievedOrder =
                await repository.findOneByExchangeOrderId('exchange-mapping-test');

            // Verify all fields are correctly mapped
            expect(retrievedOrder).toBeDefined();
            expect(retrievedOrder).not.toBeNull();
            if (!retrievedOrder) throw new Error('retrievedOrder is null');

            expect(retrievedOrder.id.toString()).toBe(originalOrder.id.toString());
            expect(retrievedOrder.exchangeOrderId).toBe(originalOrder.exchangeOrderId);
            // cloid is not stored separately, it can be derived from orderId
            expect(retrievedOrder.symbol.toString()).toBe(originalOrder.symbol.toString());
            expect(retrievedOrder.type).toBe(originalOrder.type);
            expect(retrievedOrder.side).toBe(originalOrder.side);
            expect(retrievedOrder.price).not.toBeNull();
            expect(originalOrder.price).not.toBeNull();
            if (!retrievedOrder.price || !originalOrder.price) {
                throw new Error('price is null');
            }
            expect(retrievedOrder.price.toNumber()).toBe(originalOrder.price.toNumber());
            expect(retrievedOrder.amount.toNumber()).toBe(originalOrder.amount.toNumber());
            expect(retrievedOrder.status).toBe(originalOrder.status);
            expect(retrievedOrder.gridId.equals(originalOrder.gridId)).toBe(true);
            expect(retrievedOrder.levelIndex).toBe(originalOrder.levelIndex);

            console.log('✅ Domain mapping verified');
        });
    });
});
