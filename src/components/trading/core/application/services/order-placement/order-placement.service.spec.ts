import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderPlacementService } from './order-placement.service';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { Price } from '@domain/models/primitives/price';
import { GridLevel } from '@components/trading/core/domain/services/grid-levels-calculator/grid-level';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { AgentNotApprovedError } from '@components/trading/core/domain/errors/agent-not-approved.error';

const MOCK_GRID_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_ORDER_ID = '660e8400-e29b-41d4-a716-446655440001';

const makeMockOrderDto = (overrides: Partial<OrderDto> = {}): OrderDto => ({
    id: MOCK_ORDER_ID,
    gridId: MOCK_GRID_ID,
    symbol: 'BTC',
    side: OrderSide.Buy,
    status: OrderStatus.Pending,
    type: OrderType.Limit,
    levelIndex: 0,
    price: 45000,
    amount: 0.0555,
    exchangeOrderId: null,
    createdAt: Date.now(),
    ...overrides,
});

const makeGrid = (
    symbol: string,
    lowerPrice: number,
    upperPrice: number,
    levels: number,
): GridDto => ({
    id: MOCK_GRID_ID,
    userId: 'user-1',
    symbol,
    status: GridStatus.Running,
    lowerPrice,
    upperPrice,
    levels,
    investmentUSDC: 5000,
    investmentBase: 0.1,
    trailingEnabled: false,
    trailingTriggerPercent: 5,
    trailingStepPercent: 10,
    trailingPartialClosePercent: 50,
    stopLossEnabled: false,
});

describe('OrderPlacementService', () => {
    let service: OrderPlacementService;
    let orderClient: any;
    let orderRepository: any;
    let handleAgentExpired: any;

    beforeEach(() => {
        orderClient = {
            placeSpotOrder: vi.fn(),
        };

        orderRepository = {
            createOrder: vi.fn().mockResolvedValue(makeMockOrderDto()),
            updateOrderExchangeId: vi.fn(),
            updateOrderStatus: vi.fn(),
        };

        handleAgentExpired = {
            handleAgentExpired: vi.fn().mockResolvedValue(undefined),
        };

        service = new OrderPlacementService(orderClient, orderRepository, handleAgentExpired);
    });

    describe('placeGridOrders', () => {
        it('should place all orders successfully and return count', async () => {
            const mockGrid = makeGrid('BTC', 45000, 55000, 10);

            const levels: GridLevel[] = [
                {
                    index: 0,
                    price: Price.from(45000),
                    side: OrderSide.Buy,
                    amountUSDC: 2500,
                    amountBase: 0.0555,
                },
                {
                    index: 1,
                    price: Price.from(55000),
                    side: OrderSide.Sell,
                    amountUSDC: 5500,
                    amountBase: 0.1,
                },
            ];

            orderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: '12345',
                status: OrderStatus.Placed,
            });
            orderRepository.updateOrderExchangeId.mockResolvedValue(undefined);

            const count = await service.placeGridOrders(mockGrid, levels, '0xabc');

            expect(count).toBe(2);
            expect(orderRepository.createOrder).toHaveBeenCalledTimes(2);
            expect(orderClient.placeSpotOrder).toHaveBeenCalledTimes(2);
            expect(orderRepository.updateOrderExchangeId).toHaveBeenCalledTimes(2);
            expect(orderClient.placeSpotOrder).toHaveBeenCalledWith(
                expect.objectContaining({ accountAddress: '0xabc' }),
            );
        });

        it('should handle buy order with correct amount', async () => {
            const mockGrid = makeGrid('BTC', 45000, 55000, 5);

            const levels: GridLevel[] = [
                {
                    index: 0,
                    price: Price.from(45000),
                    side: OrderSide.Buy,
                    amountUSDC: 2500,
                    amountBase: 0.0555,
                },
            ];

            orderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: '12345',
                status: OrderStatus.Placed,
            });
            orderRepository.updateOrderExchangeId.mockResolvedValue(undefined);

            await service.placeGridOrders(mockGrid, levels, '0xabc');

            const call = orderClient.placeSpotOrder.mock.calls[0][0];
            expect(call.side).toBe(OrderSide.Buy);
            expect(call.amount.toString()).toBe('0.0555');
        });

        it('should handle sell order with correct amount', async () => {
            const mockGrid = makeGrid('BTC', 45000, 55000, 5);

            const levels: GridLevel[] = [
                {
                    index: 0,
                    price: Price.from(55000),
                    side: OrderSide.Sell,
                    amountUSDC: 5500,
                    amountBase: 0.1,
                },
            ];

            orderRepository.createOrder.mockResolvedValue(
                makeMockOrderDto({ side: OrderSide.Sell }),
            );
            orderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: '12345',
                status: OrderStatus.Placed,
            });
            orderRepository.updateOrderExchangeId.mockResolvedValue(undefined);

            await service.placeGridOrders(mockGrid, levels, '0xabc');

            const call = orderClient.placeSpotOrder.mock.calls[0][0];
            expect(call.side).toBe(OrderSide.Sell);
            expect(call.amount.toString()).toBe('0.1');
        });

        it('should handle partial failures and return only successful count', async () => {
            const mockGrid = makeGrid('ETH', 2500, 3500, 5);

            const levels: GridLevel[] = [
                {
                    index: 0,
                    price: Price.from(2600),
                    side: OrderSide.Buy,
                    amountUSDC: 1500,
                    amountBase: 0.6,
                },
                {
                    index: 1,
                    price: Price.from(3000),
                    side: OrderSide.Buy,
                    amountUSDC: 1500,
                    amountBase: 0.5,
                },
            ];

            orderClient.placeSpotOrder
                .mockResolvedValueOnce({
                    exchangeOrderId: '12345',
                    status: OrderStatus.Placed,
                })
                .mockResolvedValueOnce({
                    exchangeOrderId: '',
                    status: OrderStatus.Failed,
                    error: 'Network error',
                });

            orderRepository.updateOrderExchangeId.mockResolvedValue(undefined);
            orderRepository.updateOrderStatus.mockResolvedValue(undefined);

            const count = await service.placeGridOrders(mockGrid, levels, '0xabc');

            expect(count).toBe(1);
            expect(orderRepository.createOrder).toHaveBeenCalledTimes(2);
            expect(orderClient.placeSpotOrder).toHaveBeenCalledTimes(2);
            expect(orderRepository.updateOrderExchangeId).toHaveBeenCalledTimes(1);
            expect(orderRepository.updateOrderStatus).toHaveBeenCalledTimes(1);
            expect(orderRepository.updateOrderStatus).toHaveBeenCalledWith(
                expect.any(String),
                OrderStatus.Failed,
            );
        });

        it('should mark order as failed when exchangeOrderId is empty', async () => {
            const mockGrid = makeGrid('SOL', 100, 150, 5);

            const levels: GridLevel[] = [
                {
                    index: 0,
                    price: Price.from(100),
                    side: OrderSide.Buy,
                    amountUSDC: 1500,
                    amountBase: 15,
                },
            ];

            orderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: '',
                status: OrderStatus.Placed,
            });
            orderRepository.updateOrderStatus.mockResolvedValue(undefined);

            const count = await service.placeGridOrders(mockGrid, levels, '0xabc');

            expect(count).toBe(0);
            expect(orderRepository.createOrder).toHaveBeenCalledTimes(1);
            expect(orderRepository.updateOrderStatus).toHaveBeenCalledWith(
                expect.any(String),
                OrderStatus.Failed,
            );
        });

        it('should continue placing orders even if one fails with exception', async () => {
            const mockGrid = makeGrid('BTC', 45000, 55000, 10);

            const levels: GridLevel[] = [
                {
                    index: 0,
                    price: Price.from(45000),
                    side: OrderSide.Buy,
                    amountUSDC: 2500,
                    amountBase: 0.0555,
                },
                {
                    index: 1,
                    price: Price.from(55000),
                    side: OrderSide.Sell,
                    amountUSDC: 5500,
                    amountBase: 0.1,
                },
            ];

            orderClient.placeSpotOrder
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    exchangeOrderId: '67890',
                    status: OrderStatus.Placed,
                });
            orderRepository.updateOrderExchangeId.mockResolvedValue(undefined);

            const count = await service.placeGridOrders(mockGrid, levels, '0xabc');

            expect(count).toBe(1);
            expect(orderRepository.createOrder).toHaveBeenCalledTimes(2);
            expect(orderClient.placeSpotOrder).toHaveBeenCalledTimes(2);
            expect(orderRepository.updateOrderExchangeId).toHaveBeenCalledTimes(1);
        });

        it('should save orders before placing (pre-save pattern)', async () => {
            const mockGrid = makeGrid('BTC', 45000, 55000, 10);

            const levels: GridLevel[] = [
                {
                    index: 0,
                    price: Price.from(45000),
                    side: OrderSide.Buy,
                    amountUSDC: 2500,
                    amountBase: 0.0555,
                },
            ];

            orderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: '12345',
                status: OrderStatus.Placed,
            });
            orderRepository.updateOrderExchangeId.mockResolvedValue(undefined);

            await service.placeGridOrders(mockGrid, levels, '0xabc');

            expect(orderRepository.createOrder).toHaveBeenCalledWith(
                expect.objectContaining({
                    side: OrderSide.Buy,
                    gridId: MOCK_GRID_ID,
                }),
            );
        });

        it('should handle empty levels array', async () => {
            const mockGrid = makeGrid('BTC', 45000, 55000, 10);

            const levels: GridLevel[] = [];

            const count = await service.placeGridOrders(mockGrid, levels, '0xabc');

            expect(count).toBe(0);
            expect(orderRepository.createOrder).not.toHaveBeenCalled();
            expect(orderClient.placeSpotOrder).not.toHaveBeenCalled();
        });

        it('should call handleAgentExpired and return 0 when AgentNotApprovedError is thrown', async () => {
            const mockGrid = makeGrid('BTC', 45000, 55000, 10);
            const levels: GridLevel[] = [
                {
                    index: 0,
                    price: Price.from(45000),
                    side: OrderSide.Buy,
                    amountUSDC: 2500,
                    amountBase: 0.0555,
                },
            ];

            orderClient.placeSpotOrder.mockRejectedValue(
                new AgentNotApprovedError('0xabc', 'not approved'),
            );

            const count = await service.placeGridOrders(mockGrid, levels, '0xabc');

            expect(count).toBe(0);
            expect(handleAgentExpired.handleAgentExpired).toHaveBeenCalledWith('0xabc');
            expect(orderRepository.updateOrderStatus).toHaveBeenCalledWith(
                MOCK_ORDER_ID,
                OrderStatus.Failed,
            );
        });
    });
});
