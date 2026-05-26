import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StopLossProcessorService } from './stop-loss-processor.service';
import { Decimal } from '@domain/models/primitives/decimal';
import { GridStopLossTriggeredEvent } from '@domain/models/events/trading/grid-stop-loss-triggered.event';

const STOP_LOSS_PRICE = 100;
const NOW = 1_000_000;

const makeGrid = (overrides: Record<string, unknown> = {}) => ({
    id: 'grid-1',
    symbol: 'ETH',
    lowerPrice: 110,
    upperPrice: 200,
    levels: 10,
    investmentUSDC: 1000,
    investmentBase: 0.5,
    stopLossEnabled: true,
    stopLossPrice: STOP_LOSS_PRICE,
    stopLossTriggeredAt: undefined,
    trailingEnabled: false,
    trailingTriggerPercent: 5,
    trailingStepPercent: 2,
    trailingPartialClosePercent: 50,
    ...overrides,
});

describe('StopLossProcessorService', () => {
    let sut: StopLossProcessorService;
    let mockBreachEvaluator: { evaluate: ReturnType<typeof vi.fn> };
    let mockGrids: { markStoppedByStopLoss: ReturnType<typeof vi.fn> };
    let mockEventPublisher: { publish: ReturnType<typeof vi.fn> };
    let mockCancellation: { cancelActiveOrders: ReturnType<typeof vi.fn> };
    let mockBalanceAttribution: { computeSellAmount: ReturnType<typeof vi.fn> };
    let mockMarketSell: { execute: ReturnType<typeof vi.fn> };

    const accountAddress = '0xabc';
    const deepBelow = STOP_LOSS_PRICE * 0.997;

    beforeEach(() => {
        mockBreachEvaluator = { evaluate: vi.fn().mockResolvedValue(false) };
        mockGrids = { markStoppedByStopLoss: vi.fn().mockResolvedValue(undefined) };
        mockEventPublisher = { publish: vi.fn().mockResolvedValue(undefined) };
        mockCancellation = {
            cancelActiveOrders: vi.fn().mockResolvedValue({ cancelledCount: 1, failedCount: 0 }),
        };
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

        sut = new StopLossProcessorService(
            mockBreachEvaluator as any,
            mockGrids as any,
            mockEventPublisher as any,
            mockCancellation as any,
            mockBalanceAttribution as any,
            mockMarketSell as any,
        );
    });

    describe('process — early exits', () => {
        it('returns false without calling evaluator when stop-loss is disabled', async () => {
            const grid = makeGrid({ stopLossEnabled: false });
            expect(await sut.process(grid as any, accountAddress, deepBelow, NOW)).toBe(false);
            expect(mockBreachEvaluator.evaluate).not.toHaveBeenCalled();
        });

        it('returns false without calling evaluator when stopLossPrice is null', async () => {
            const grid = makeGrid({ stopLossPrice: null });
            expect(await sut.process(grid as any, accountAddress, deepBelow, NOW)).toBe(false);
            expect(mockBreachEvaluator.evaluate).not.toHaveBeenCalled();
        });

        it('returns false without calling evaluator when stopLossTriggeredAt is already set', async () => {
            const grid = makeGrid({ stopLossTriggeredAt: Date.now() });
            expect(await sut.process(grid as any, accountAddress, deepBelow, NOW)).toBe(false);
            expect(mockBreachEvaluator.evaluate).not.toHaveBeenCalled();
        });

        it('returns false and does not trigger teardown when evaluator returns false', async () => {
            mockBreachEvaluator.evaluate.mockResolvedValue(false);
            const grid = makeGrid();
            const result = await sut.process(grid as any, accountAddress, deepBelow, NOW);
            expect(result).toBe(false);
            expect(mockGrids.markStoppedByStopLoss).not.toHaveBeenCalled();
        });
    });

    describe('process — teardown', () => {
        beforeEach(() => {
            mockBreachEvaluator.evaluate.mockResolvedValue(true);
        });

        it('returns true and triggers teardown when evaluator confirms breach', async () => {
            const grid = makeGrid();
            expect(await sut.process(grid as any, accountAddress, deepBelow, NOW)).toBe(true);
            expect(mockGrids.markStoppedByStopLoss).toHaveBeenCalledWith('grid-1', deepBelow);
        });

        it('calls markStoppedByStopLoss before cancellation', async () => {
            const grid = makeGrid();
            await sut.process(grid as any, accountAddress, deepBelow, NOW);
            const markOrder = mockGrids.markStoppedByStopLoss.mock.invocationCallOrder[0];
            const cancelOrder = mockCancellation.cancelActiveOrders.mock.invocationCallOrder[0];
            expect(markOrder).toBeLessThan(cancelOrder);
        });

        it('cancels orders with the correct grid id and account address', async () => {
            const grid = makeGrid();
            await sut.process(grid as any, accountAddress, deepBelow, NOW);
            expect(mockCancellation.cancelActiveOrders).toHaveBeenCalledWith('grid-1', '0xabc');
        });

        it('publishes success event after market sell fills', async () => {
            const grid = makeGrid();
            await sut.process(grid as any, accountAddress, deepBelow, NOW);
            expect(mockEventPublisher.publish).toHaveBeenCalledOnce();
            const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
            expect(event.success).toBe(true);
            expect(event.gridId).toBe('grid-1');
            expect(event.soldBaseAmount).toBe(0.5);
        });

        it('skips market sell and publishes success with zero amounts when sell amount is zero', async () => {
            mockBalanceAttribution.computeSellAmount.mockResolvedValue(Decimal.zero());
            const grid = makeGrid();
            await sut.process(grid as any, accountAddress, deepBelow, NOW);
            expect(mockMarketSell.execute).not.toHaveBeenCalled();
            const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
            expect(event.soldBaseAmount).toBe(0);
            expect(event.success).toBe(true);
        });

        it('includes cancel failure warning in event even when sell amount is zero', async () => {
            mockBalanceAttribution.computeSellAmount.mockResolvedValue(Decimal.zero());
            mockCancellation.cancelActiveOrders.mockResolvedValue({
                cancelledCount: 0,
                failedCount: 1,
            });
            const grid = makeGrid();
            await sut.process(grid as any, accountAddress, deepBelow, NOW);
            const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
            expect(event.errorMessage).toContain('1 order(s) could not be cancelled');
        });

        it('includes cancel failure warning in event when some orders failed to cancel', async () => {
            mockCancellation.cancelActiveOrders.mockResolvedValue({
                cancelledCount: 1,
                failedCount: 2,
            });
            const grid = makeGrid();
            await sut.process(grid as any, accountAddress, deepBelow, NOW);
            const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
            expect(event.errorMessage).toContain('2 order(s) could not be cancelled');
        });

        it('publishes failure event when market sell fails to fill', async () => {
            mockMarketSell.execute.mockResolvedValue({
                success: false,
                soldBaseAmount: 0,
                receivedUSDC: 0,
                errorMessage:
                    "Market sell failed: order didn't fill at the best available price after 2 attempts.",
            });
            const grid = makeGrid();
            await sut.process(grid as any, accountAddress, deepBelow, NOW);
            const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
            expect(event.success).toBe(false);
            expect(event.errorMessage).toContain('Market sell failed');
        });

        it('publishes failure event when teardown throws after marking grid stopped', async () => {
            mockCancellation.cancelActiveOrders.mockRejectedValue(new Error('DB connection lost'));
            const grid = makeGrid();
            await sut.process(grid as any, accountAddress, deepBelow, NOW);
            expect(mockGrids.markStoppedByStopLoss).toHaveBeenCalledWith('grid-1', deepBelow);
            expect(mockEventPublisher.publish).toHaveBeenCalledOnce();
            const event = mockEventPublisher.publish.mock.calls[0][0] as GridStopLossTriggeredEvent;
            expect(event.success).toBe(false);
            expect(event.soldBaseAmount).toBe(0);
            expect(event.errorMessage).toContain('Teardown error');
        });
    });
});
