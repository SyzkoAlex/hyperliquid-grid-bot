import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StopLossMonitorService } from './stop-loss-monitor.service';
import { StopLossWatchDecision } from '@components/trading/core/domain/services/stop-loss-watcher/types/stop-loss-watch-decision';
import { GridStatus } from '@domain/models/grid/grid-status';

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

describe('StopLossMonitorService', () => {
    let sut: StopLossMonitorService;
    let mockWatcher: { evaluate: ReturnType<typeof vi.fn> };
    let mockTriggerStopLoss: { execute: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockWatcher = { evaluate: vi.fn().mockReturnValue(StopLossWatchDecision.NoBreach) };
        mockTriggerStopLoss = { execute: vi.fn().mockResolvedValue({ success: true }) };

        sut = new StopLossMonitorService(mockWatcher as any, mockTriggerStopLoss as any);
    });

    it('returns false when stop-loss is disabled', async () => {
        const grid = makeGrid({ stopLossEnabled: false });
        const result = await sut.processGrid(grid, 1800, '0xabc');
        expect(result).toBe(false);
        expect(mockWatcher.evaluate).not.toHaveBeenCalled();
    });

    it('returns false when stopLossTriggeredAt is already set', async () => {
        const grid = makeGrid({ stopLossTriggeredAt: Date.now() - 1000 });
        const result = await sut.processGrid(grid, 1800, '0xabc');
        expect(result).toBe(false);
        expect(mockWatcher.evaluate).not.toHaveBeenCalled();
    });

    it('returns false when watcher returns NoBreach', async () => {
        mockWatcher.evaluate.mockReturnValue(StopLossWatchDecision.NoBreach);
        const result = await sut.processGrid(makeGrid(), 2100, '0xabc');
        expect(result).toBe(false);
        expect(mockTriggerStopLoss.execute).not.toHaveBeenCalled();
    });

    it('returns false when watcher returns BreachUnconfirmed', async () => {
        mockWatcher.evaluate.mockReturnValue(StopLossWatchDecision.BreachUnconfirmed);
        const result = await sut.processGrid(makeGrid(), 1850, '0xabc');
        expect(result).toBe(false);
        expect(mockTriggerStopLoss.execute).not.toHaveBeenCalled();
    });

    it('invokes triggerStopLoss and returns true when watcher returns Trigger', async () => {
        mockWatcher.evaluate.mockReturnValue(StopLossWatchDecision.Trigger);
        const grid = makeGrid();
        const result = await sut.processGrid(grid, 1850, '0xabc');

        expect(result).toBe(true);
        expect(mockTriggerStopLoss.execute).toHaveBeenCalledWith({
            gridId: 'grid-1',
            symbol: 'ETH',
            stopLossPrice: 1900,
            accountAddress: '0xabc',
        });
    });
});
