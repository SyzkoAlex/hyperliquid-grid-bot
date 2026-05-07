import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TriggerStopLossUseCase } from './trigger-stop-loss.use-case';
import { TriggerStopLossParams } from './trigger-stop-loss-params';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderStatus } from '@domain/models/order/order-status';
import { Decimal } from '@domain/models/primitives/decimal';
import { Price } from '@domain/models/primitives/price';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { UserState } from '@components/trading/core/domain/models/user-state/user-state';
import { AssetPosition } from '@components/trading/core/domain/models/user-state/asset-position';
import { GridStopLossTriggeredEvent } from '@domain/models/events/trading/grid-stop-loss-triggered.event';

const makeGrid = (overrides = {}) => ({
    id: 'grid-1',
    symbol: 'ETH',
    status: GridStatus.Running,
    lowerPrice: 2000,
    upperPrice: 3000,
    levels: 10,
    investmentUSDC: 1000,
    investmentBase: 0.5,
    trailingEnabled: false,
    trailingTriggerPercent: 5,
    trailingStepPercent: 10,
    trailingPartialClosePercent: 50,
    stopLossEnabled: true,
    stopLossPrice: 1900,
    ...overrides,
});

const makeOrder = (overrides = {}) => ({
    id: 'order-1',
    gridId: 'grid-1',
    symbol: 'ETH',
    side: 'buy' as const,
    status: OrderStatus.Placed,
    type: 'limit' as const,
    levelIndex: 0,
    price: 2000,
    amount: 0.05,
    exchangeOrderId: 'ex-1',
    createdAt: Date.now(),
    ...overrides,
});

const makeUserState = (baseAmount: number) =>
    UserState.create({
        withdrawableBalance: Decimal.from(1000),
        assetPositions: [
            AssetPosition.create({
                symbol: TradingSymbol.create('ETH'),
                size: Decimal.from(baseAmount),
            }),
        ],
    });

describe('TriggerStopLossUseCase', () => {
    let sut: TriggerStopLossUseCase;
    let mockGrids: {
        markStopLossTriggered: ReturnType<typeof vi.fn>;
        updateGridStatus: ReturnType<typeof vi.fn>;
        findActiveOrdersByGridId: ReturnType<typeof vi.fn>;
        updateOrderStatus: ReturnType<typeof vi.fn>;
        findGridById: ReturnType<typeof vi.fn>;
    };
    let mockExchange: {
        getUserSpotState: ReturnType<typeof vi.fn>;
        getCurrentPrice: ReturnType<typeof vi.fn>;
        placeSpotMarketSell: ReturnType<typeof vi.fn>;
        cancelSpotOrder: ReturnType<typeof vi.fn>;
    };
    let mockEventPublisher: { publish: ReturnType<typeof vi.fn> };
    let mockUserBalanceExtractor: { extractBalances: ReturnType<typeof vi.fn> };

    const params: TriggerStopLossParams = {
        gridId: 'grid-1',
        symbol: 'ETH',
        stopLossPrice: 1900,
        accountAddress: '0xabc',
    };

    beforeEach(() => {
        mockGrids = {
            markStopLossTriggered: vi.fn().mockResolvedValue(undefined),
            updateGridStatus: vi.fn().mockResolvedValue(undefined),
            findActiveOrdersByGridId: vi.fn().mockResolvedValue([makeOrder()]),
            updateOrderStatus: vi.fn().mockResolvedValue(undefined),
            findGridById: vi.fn().mockResolvedValue(makeGrid()),
        };
        mockExchange = {
            getUserSpotState: vi.fn().mockResolvedValue(makeUserState(0.5)),
            getCurrentPrice: vi.fn().mockResolvedValue(Price.from(1880)),
            placeSpotMarketSell: vi
                .fn()
                .mockResolvedValue({ exchangeOrderId: 'ex-sl', status: OrderStatus.Filled }),
            cancelSpotOrder: vi.fn().mockResolvedValue({ success: true }),
        };
        mockEventPublisher = { publish: vi.fn().mockResolvedValue(undefined) };
        mockUserBalanceExtractor = {
            extractBalances: vi.fn().mockReturnValue({
                usdcBalance: Decimal.from(1000),
                baseBalance: Decimal.from(0.5),
            }),
        };

        sut = new TriggerStopLossUseCase(
            mockGrids as any,
            mockExchange as any,
            mockEventPublisher as any,
            mockUserBalanceExtractor as any,
        );
    });

    it('marks SL triggered and flips status before selling', async () => {
        await sut.execute(params);

        const markCall = mockGrids.markStopLossTriggered.mock.invocationCallOrder[0];
        const statusCall = mockGrids.updateGridStatus.mock.invocationCallOrder[0];
        const sellCall = mockExchange.placeSpotMarketSell.mock.invocationCallOrder[0];

        expect(markCall).toBeLessThan(statusCall);
        expect(statusCall).toBeLessThan(sellCall);
        expect(mockGrids.updateGridStatus).toHaveBeenCalledWith('grid-1', GridStatus.Stopped);
    });

    it('cancels all active orders before selling', async () => {
        await sut.execute(params);

        expect(mockExchange.cancelSpotOrder).toHaveBeenCalledOnce();
        expect(mockGrids.updateOrderStatus).toHaveBeenCalledWith('order-1', OrderStatus.Cancelled);
    });

    it('publishes success event when IOC sell fills on first attempt', async () => {
        await sut.execute(params);

        expect(mockEventPublisher.publish).toHaveBeenCalledOnce();
        const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
        expect(event.success).toBe(true);
        expect(event.soldBaseAmount).toBe(0.5);
        expect(event.gridId).toBe('grid-1');
    });

    it('retries IOC sell at wider cap and publishes success on second attempt', async () => {
        mockExchange.placeSpotMarketSell
            .mockResolvedValueOnce({ exchangeOrderId: 'ex-1', status: OrderStatus.Placed })
            .mockResolvedValueOnce({ exchangeOrderId: 'ex-2', status: OrderStatus.Filled });

        const result = await sut.execute(params);

        expect(result.success).toBe(true);
        expect(mockExchange.placeSpotMarketSell).toHaveBeenCalledTimes(2);
    });

    it('publishes failure event when both IOC attempts fail', async () => {
        mockExchange.placeSpotMarketSell.mockResolvedValue({
            exchangeOrderId: 'ex-1',
            status: OrderStatus.Placed,
        });

        const result = await sut.execute(params);

        expect(result.success).toBe(false);
        expect(mockExchange.placeSpotMarketSell).toHaveBeenCalledTimes(2);

        const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
        expect(event.success).toBe(false);
        expect(event.errorMessage).toBeDefined();
    });

    it('publishes success with soldBaseAmount=0 when no base balance', async () => {
        mockUserBalanceExtractor.extractBalances.mockReturnValue({
            usdcBalance: Decimal.from(1000),
            baseBalance: Decimal.zero(),
        });

        const result = await sut.execute(params);

        expect(result.success).toBe(true);
        expect(result.soldBaseAmount).toBe(0);
        expect(mockExchange.placeSpotMarketSell).not.toHaveBeenCalled();

        const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
        expect(event.soldBaseAmount).toBe(0);
    });

    it('skips cancel loop when there are no active orders', async () => {
        mockGrids.findActiveOrdersByGridId.mockResolvedValue([]);

        await sut.execute(params);

        expect(mockExchange.cancelSpotOrder).not.toHaveBeenCalled();
        expect(mockEventPublisher.publish).toHaveBeenCalledOnce();
    });
});
