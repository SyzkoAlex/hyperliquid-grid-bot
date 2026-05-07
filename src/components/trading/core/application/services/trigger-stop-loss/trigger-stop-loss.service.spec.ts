import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TriggerStopLossService } from './trigger-stop-loss.service';
import { TriggerStopLossParams } from './trigger-stop-loss-params';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Decimal } from '@domain/models/primitives/decimal';
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

describe('TriggerStopLossService', () => {
    let sut: TriggerStopLossService;
    let mockGrids: {
        markStopLossTriggered: ReturnType<typeof vi.fn>;
        updateGridStatus: ReturnType<typeof vi.fn>;
        findActiveOrdersByGridId: ReturnType<typeof vi.fn>;
        findGridById: ReturnType<typeof vi.fn>;
    };
    let mockEventPublisher: { publish: ReturnType<typeof vi.fn> };
    let mockCancellation: { cancelActiveOrders: ReturnType<typeof vi.fn> };
    let mockBalanceAttribution: { computeSellAmount: ReturnType<typeof vi.fn> };
    let mockMarketSell: { execute: ReturnType<typeof vi.fn> };

    const params: TriggerStopLossParams = {
        gridId: 'grid-1',
        symbol: 'ETH',
        stopLossPrice: 1900,
        currentMid: 1880,
        accountAddress: '0xabc',
    };

    beforeEach(() => {
        mockGrids = {
            markStopLossTriggered: vi.fn().mockResolvedValue(undefined),
            updateGridStatus: vi.fn().mockResolvedValue(undefined),
            findActiveOrdersByGridId: vi.fn().mockResolvedValue([]),
            findGridById: vi.fn().mockResolvedValue(makeGrid()),
        };
        mockEventPublisher = { publish: vi.fn().mockResolvedValue(undefined) };
        mockCancellation = { cancelActiveOrders: vi.fn().mockResolvedValue(undefined) };
        mockBalanceAttribution = {
            computeSellAmount: vi.fn().mockResolvedValue(Decimal.from(0.5)),
        };
        mockMarketSell = {
            execute: vi.fn().mockResolvedValue({
                success: true,
                soldBaseAmount: 0.5,
                receivedUSDC: 940,
            }),
        };

        sut = new TriggerStopLossService(
            mockGrids as any,
            mockEventPublisher as any,
            mockCancellation as any,
            mockBalanceAttribution as any,
            mockMarketSell as any,
        );
    });

    it('marks SL triggered and flips status before delegating to sub-services', async () => {
        await sut.execute(params);

        const markCall = mockGrids.markStopLossTriggered.mock.invocationCallOrder[0];
        const statusCall = mockGrids.updateGridStatus.mock.invocationCallOrder[0];
        const cancelCall = mockCancellation.cancelActiveOrders.mock.invocationCallOrder[0];

        expect(markCall).toBeLessThan(statusCall);
        expect(statusCall).toBeLessThan(cancelCall);
        expect(mockGrids.updateGridStatus).toHaveBeenCalledWith('grid-1', GridStatus.Stopped);
    });

    it('delegates order cancellation to StopLossOrderCancellationService', async () => {
        await sut.execute(params);

        expect(mockCancellation.cancelActiveOrders).toHaveBeenCalledWith('grid-1', '0xabc');
    });

    it('delegates sell amount computation to StopLossBalanceAttributionService', async () => {
        await sut.execute(params);

        expect(mockBalanceAttribution.computeSellAmount).toHaveBeenCalledOnce();
        const [gridId, grid, accountAddress] =
            mockBalanceAttribution.computeSellAmount.mock.calls[0];
        expect(gridId).toBe('grid-1');
        expect(grid.id).toBe('grid-1');
        expect(accountAddress).toBe('0xabc');
    });

    it('delegates market sell to StopLossMarketSellService', async () => {
        await sut.execute(params);

        expect(mockMarketSell.execute).toHaveBeenCalledOnce();
        const sellParams = mockMarketSell.execute.mock.calls[0][0];
        expect(sellParams.gridId).toBe('grid-1');
        expect(sellParams.symbol).toBe('ETH');
        expect(sellParams.accountAddress).toBe('0xabc');
    });

    it('publishes success event when market sell succeeds', async () => {
        await sut.execute(params);

        expect(mockEventPublisher.publish).toHaveBeenCalledOnce();
        const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
        expect(event.success).toBe(true);
        expect(event.soldBaseAmount).toBe(0.5);
        expect(event.gridId).toBe('grid-1');
    });

    it('publishes success with soldBaseAmount=0 when sell amount is zero', async () => {
        mockBalanceAttribution.computeSellAmount.mockResolvedValue(Decimal.zero());

        const result = await sut.execute(params);

        expect(result.success).toBe(true);
        expect(result.soldBaseAmount).toBe(0);
        expect(mockMarketSell.execute).not.toHaveBeenCalled();

        const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
        expect(event.soldBaseAmount).toBe(0);
    });

    it('publishes failure event and returns failure when findGridById returns null', async () => {
        mockGrids.findGridById.mockResolvedValue(null);

        const result = await sut.execute(params);

        expect(result.success).toBe(false);
        expect(result.soldBaseAmount).toBe(0);
        expect(result.errorMessage).toContain('grid-1');

        expect(mockEventPublisher.publish).toHaveBeenCalledOnce();
        const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
        expect(event.success).toBe(false);
        expect(event.errorMessage).toContain('grid-1');

        expect(mockMarketSell.execute).not.toHaveBeenCalled();
    });

    it('propagates sell failure result and publishes failure event', async () => {
        mockMarketSell.execute.mockResolvedValue({
            success: false,
            soldBaseAmount: 0,
            receivedUSDC: 0,
            errorMessage: 'IOC sell unfilled after 2 attempts.',
        });

        const result = await sut.execute(params);

        expect(result.success).toBe(false);
        expect(mockEventPublisher.publish).toHaveBeenCalledOnce();
        const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
        expect(event.success).toBe(false);
        expect(event.errorMessage).toBeDefined();
    });
});
