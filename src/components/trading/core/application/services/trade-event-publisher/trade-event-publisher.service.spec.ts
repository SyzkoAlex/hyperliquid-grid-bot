import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TradeEventPublisher } from './trade-event-publisher.service';
import { OrderType } from '@domain/models/order/order-type';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Decimal } from '@domain/models/primitives/decimal';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';

const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('TradeEventPublisher', () => {
    let service: TradeEventPublisher;
    let mockPublisher: { publish: ReturnType<typeof vi.fn> };
    let mockProfitCalculator: { calculate: ReturnType<typeof vi.fn> };

    // Grid: 11 levels, spacing = (55000-45000)/(11-1) = 1000
    const testGrid: GridDto = {
        id: GRID_ID,
        symbol: 'BTC',
        status: GridStatus.Running,
        lowerPrice: 45000,
        upperPrice: 55000,
        levels: 11,
        investmentUSDC: 5000,
        investmentBase: 0.1,
        trailingEnabled: false,
        trailingTriggerPercent: 5,
        trailingStepPercent: 10,
        trailingPartialClosePercent: 50,
    };

    const makeBuyOrder = (overrides: Partial<OrderDto> = {}): OrderDto => ({
        id: '660e8400-e29b-41d4-a716-446655440001',
        gridId: GRID_ID,
        symbol: 'BTC',
        side: OrderSide.Buy,
        status: OrderStatus.Filled,
        type: OrderType.Limit,
        levelIndex: 5,
        price: 50000,
        amount: 0.01,
        exchangeOrderId: 'exchange-789',
        createdAt: Date.now(),
        ...overrides,
    });

    const makeSellOrder = (overrides: Partial<OrderDto> = {}): OrderDto => ({
        id: '770e8400-e29b-41d4-a716-446655440002',
        gridId: GRID_ID,
        symbol: 'BTC',
        side: OrderSide.Sell,
        status: OrderStatus.Filled,
        type: OrderType.Limit,
        levelIndex: 6,
        price: 51000,
        amount: 0.01,
        exchangeOrderId: 'exchange-012',
        createdAt: Date.now(),
        ...overrides,
    });

    beforeEach(() => {
        mockPublisher = { publish: vi.fn().mockResolvedValue(undefined) };

        mockProfitCalculator = {
            calculate: vi
                .fn()
                .mockImplementation(
                    (amount: number, upperPrice: number, lowerPrice: number, levels: number) => {
                        const spacing = (upperPrice - lowerPrice) / (levels - 1);
                        return Decimal.from(spacing * amount);
                    },
                ),
        };

        service = new TradeEventPublisher(mockPublisher as any, mockProfitCalculator as any);
    });

    it('should publish OrderOpenedEvent for a BUY fill and return null profit', async () => {
        const buyOrder = makeBuyOrder();

        const profit = await service.publishFillEvent(buyOrder, testGrid);

        expect(profit).toBeNull();
        expect(mockProfitCalculator.calculate).not.toHaveBeenCalled();

        expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
        const event = mockPublisher.publish.mock.calls[0][0];
        expect(event).toBeInstanceOf(OrderOpenedEvent);
        expect(event.gridId).toBe(GRID_ID);
        expect(event.side).toBe(OrderSide.Buy);
        expect(event.price).toBe(50000);
        expect(event.amount).toBe(0.01);
        expect(event.total).toBe(500);
        // 1-based level: levelIndex(5) + 1 = 6
        expect(event.level).toBe(6);
        expect(event.totalLevels).toBe(11);
    });

    it('should publish OrderClosedEvent with profit for a SELL fill and return profit', async () => {
        const sellOrder = makeSellOrder();

        const profit = await service.publishFillEvent(sellOrder, testGrid);

        // Grid spacing = (55000 - 45000) / 10 = 1000, profit = 1000 * 0.01 = 10
        expect(profit).not.toBeNull();
        expect(profit!.toNumber()).toBe(10);

        expect(mockProfitCalculator.calculate).toHaveBeenCalledWith(0.01, 55000, 45000, 11);

        expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
        const event = mockPublisher.publish.mock.calls[0][0];
        expect(event).toBeInstanceOf(OrderClosedEvent);
        expect(event.profit).toBe(10);
        // 1-based level: levelIndex(6) + 1 = 7
        expect(event.level).toBe(7);
        expect(event.totalLevels).toBe(11);
    });

    it('should use 1-based level index in both event types', async () => {
        const buyAtLevel0 = makeBuyOrder({ levelIndex: 0, price: 45000 });
        const sellAtLevel10 = makeSellOrder({ levelIndex: 10, price: 55000 });

        await service.publishFillEvent(buyAtLevel0, testGrid);
        const openedEvent = mockPublisher.publish.mock.calls[0][0];
        expect(openedEvent.level).toBe(1);

        mockPublisher.publish.mockClear();

        await service.publishFillEvent(sellAtLevel10, testGrid);
        const closedEvent = mockPublisher.publish.mock.calls[0][0];
        expect(closedEvent.level).toBe(11);
    });
});
