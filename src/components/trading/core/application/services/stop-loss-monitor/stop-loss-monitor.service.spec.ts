import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StopLossMonitorService } from './stop-loss-monitor.service';
import { StopLossWatchDecision } from '@components/trading/core/application/services/stop-loss-watcher/types/stop-loss-watch-decision';
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

    beforeEach(() => {
        mockWatcher = { evaluate: vi.fn().mockReturnValue(StopLossWatchDecision.NoBreach) };

        sut = new StopLossMonitorService(mockWatcher as any);
    });

    it('returns NoBreach when stop-loss is disabled', () => {
        const grid = makeGrid({ stopLossEnabled: false });
        const result = sut.evaluateGrid(grid, 1800);
        expect(result).toBe(StopLossWatchDecision.NoBreach);
        expect(mockWatcher.evaluate).not.toHaveBeenCalled();
    });

    it('returns NoBreach when stopLossTriggeredAt is already set', () => {
        const grid = makeGrid({ stopLossTriggeredAt: Date.now() - 1000 });
        const result = sut.evaluateGrid(grid, 1800);
        expect(result).toBe(StopLossWatchDecision.NoBreach);
        expect(mockWatcher.evaluate).not.toHaveBeenCalled();
    });

    it('returns NoBreach when watcher returns NoBreach', () => {
        mockWatcher.evaluate.mockReturnValue(StopLossWatchDecision.NoBreach);
        const result = sut.evaluateGrid(makeGrid(), 2100);
        expect(result).toBe(StopLossWatchDecision.NoBreach);
    });

    it('returns BreachUnconfirmed when watcher returns BreachUnconfirmed', () => {
        mockWatcher.evaluate.mockReturnValue(StopLossWatchDecision.BreachUnconfirmed);
        const result = sut.evaluateGrid(makeGrid(), 1850);
        expect(result).toBe(StopLossWatchDecision.BreachUnconfirmed);
    });

    it('returns Trigger when watcher returns Trigger', () => {
        mockWatcher.evaluate.mockReturnValue(StopLossWatchDecision.Trigger);
        const grid = makeGrid();
        const result = sut.evaluateGrid(grid, 1850);

        expect(result).toBe(StopLossWatchDecision.Trigger);
        expect(mockWatcher.evaluate).toHaveBeenCalledWith({
            gridId: 'grid-1',
            stopLossEnabled: true,
            stopLossPrice: 1900,
            currentPrice: 1850,
            now: expect.any(Number),
        });
    });
});
