import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderPlacementService } from './order-placement.service';
import { Grid } from '@domain/models/grid/grid';
import { GridMode } from '@domain/models/grid/grid-mode';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { GridLevel } from '@components/trading/core/domain/services/grid-levels-calculator/grid-level';

describe('OrderPlacementService', () => {
    let service: OrderPlacementService;
    let orderClient: any;
    let orderRepository: any;

    beforeEach(() => {
        orderClient = {
            placeSpotOrder: vi.fn(),
        };

        orderRepository = {
            save: vi.fn(),
            updateExchangeOrderId: vi.fn(),
            updateStatus: vi.fn(),
        };

        service = new OrderPlacementService(orderClient, orderRepository);
    });

    describe('placeGridOrders', () => {
        it('should place all orders successfully and return count', async () => {
            const mockGrid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(55000),
                levels: 10,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

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

            orderRepository.save.mockResolvedValue(undefined);
            orderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: '12345',
                status: OrderStatus.Placed,
            });
            orderRepository.updateExchangeOrderId.mockResolvedValue(undefined);

            const count = await service.placeGridOrders(mockGrid, levels);

            expect(count).toBe(2);
            expect(orderRepository.save).toHaveBeenCalledTimes(2);
            expect(orderClient.placeSpotOrder).toHaveBeenCalledTimes(2);
            expect(orderRepository.updateExchangeOrderId).toHaveBeenCalledTimes(2);
        });

        it('should handle buy order with correct amount', async () => {
            const mockGrid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(55000),
                levels: 5,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

            const levels: GridLevel[] = [
                {
                    index: 0,
                    price: Price.from(45000),
                    side: OrderSide.Buy,
                    amountUSDC: 2500,
                    amountBase: 0.0555,
                },
            ];

            orderRepository.save.mockResolvedValue(undefined);
            orderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: '12345',
                status: OrderStatus.Placed,
            });
            orderRepository.updateExchangeOrderId.mockResolvedValue(undefined);

            await service.placeGridOrders(mockGrid, levels);

            const call = orderClient.placeSpotOrder.mock.calls[0][0];
            expect(call.side).toBe(OrderSide.Buy);
            expect(call.amount.toString()).toBe('0.0555');
        });

        it('should handle sell order with correct amount', async () => {
            const mockGrid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(55000),
                levels: 5,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

            const levels: GridLevel[] = [
                {
                    index: 0,
                    price: Price.from(55000),
                    side: OrderSide.Sell,
                    amountUSDC: 5500,
                    amountBase: 0.1,
                },
            ];

            orderRepository.save.mockResolvedValue(undefined);
            orderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: '12345',
                status: OrderStatus.Placed,
            });
            orderRepository.updateExchangeOrderId.mockResolvedValue(undefined);

            await service.placeGridOrders(mockGrid, levels);

            const call = orderClient.placeSpotOrder.mock.calls[0][0];
            expect(call.side).toBe(OrderSide.Sell);
            expect(call.amount.toString()).toBe('0.1');
        });

        it('should handle partial failures and return only successful count', async () => {
            const mockGrid = Grid.create({
                symbol: TradingSymbol.create('ETH'),
                mode: GridMode.Long,
                lowerPrice: Price.from(2500),
                upperPrice: Price.from(3500),
                levels: 5,
                investmentUSDC: Decimal.from(3000),
                investmentBase: Decimal.from(0.5),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

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

            orderRepository.save.mockResolvedValue(undefined);
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

            orderRepository.updateExchangeOrderId.mockResolvedValue(undefined);
            orderRepository.updateStatus.mockResolvedValue(undefined);

            const count = await service.placeGridOrders(mockGrid, levels);

            expect(count).toBe(1);
            expect(orderRepository.save).toHaveBeenCalledTimes(2);
            expect(orderClient.placeSpotOrder).toHaveBeenCalledTimes(2);
            expect(orderRepository.updateExchangeOrderId).toHaveBeenCalledTimes(1);
            expect(orderRepository.updateStatus).toHaveBeenCalledTimes(1);
            expect(orderRepository.updateStatus).toHaveBeenCalledWith(
                expect.any(String),
                OrderStatus.Failed,
            );
        });

        it('should mark order as failed when exchangeOrderId is empty', async () => {
            const mockGrid = Grid.create({
                symbol: TradingSymbol.create('SOL'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(100),
                upperPrice: Price.from(150),
                levels: 5,
                investmentUSDC: Decimal.from(1500),
                investmentBase: Decimal.from(10),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

            const levels: GridLevel[] = [
                {
                    index: 0,
                    price: Price.from(100),
                    side: OrderSide.Buy,
                    amountUSDC: 1500,
                    amountBase: 15,
                },
            ];

            orderRepository.save.mockResolvedValue(undefined);
            orderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: '',
                status: OrderStatus.Placed,
            });
            orderRepository.updateStatus.mockResolvedValue(undefined);

            const count = await service.placeGridOrders(mockGrid, levels);

            expect(count).toBe(0);
            expect(orderRepository.save).toHaveBeenCalledTimes(1);
            expect(orderRepository.updateStatus).toHaveBeenCalledWith(
                expect.any(String),
                OrderStatus.Failed,
            );
        });

        it('should continue placing orders even if one fails with exception', async () => {
            const mockGrid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(55000),
                levels: 10,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

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

            orderRepository.save.mockResolvedValue(undefined);
            orderClient.placeSpotOrder
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    exchangeOrderId: '67890',
                    status: OrderStatus.Placed,
                });
            orderRepository.updateExchangeOrderId.mockResolvedValue(undefined);

            const count = await service.placeGridOrders(mockGrid, levels);

            expect(count).toBe(1);
            expect(orderRepository.save).toHaveBeenCalledTimes(2);
            expect(orderClient.placeSpotOrder).toHaveBeenCalledTimes(2);
            expect(orderRepository.updateExchangeOrderId).toHaveBeenCalledTimes(1);
        });

        it('should save orders with pending status before placing', async () => {
            const mockGrid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(55000),
                levels: 10,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

            const levels: GridLevel[] = [
                {
                    index: 0,
                    price: Price.from(45000),
                    side: OrderSide.Buy,
                    amountUSDC: 2500,
                    amountBase: 0.0555,
                },
            ];

            orderRepository.save.mockResolvedValue(undefined);
            orderClient.placeSpotOrder.mockResolvedValue({
                exchangeOrderId: '12345',
                status: OrderStatus.Placed,
            });
            orderRepository.updateExchangeOrderId.mockResolvedValue(undefined);

            await service.placeGridOrders(mockGrid, levels);

            expect(orderRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: OrderStatus.Pending,
                }),
            );
        });

        it('should handle empty levels array', async () => {
            const mockGrid = Grid.create({
                symbol: TradingSymbol.create('BTC'),
                mode: GridMode.Neutral,
                lowerPrice: Price.from(45000),
                upperPrice: Price.from(55000),
                levels: 10,
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
                trailingEnabled: false,
                trailingTriggerPercent: 5,
                trailingStepPercent: 10,
                trailingPartialClosePercent: 50,
            });

            const levels: GridLevel[] = [];

            const count = await service.placeGridOrders(mockGrid, levels);

            expect(count).toBe(0);
            expect(orderRepository.save).not.toHaveBeenCalled();
            expect(orderClient.placeSpotOrder).not.toHaveBeenCalled();
        });
    });
});
