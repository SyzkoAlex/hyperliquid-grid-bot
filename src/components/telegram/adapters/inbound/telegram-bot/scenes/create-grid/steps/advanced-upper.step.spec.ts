import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedUpperStep } from './advanced-upper.step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';

describe('AdvancedUpperStep', () => {
    let step: AdvancedUpperStep;
    let mockTradingApi: TradingApiPort;

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn(),
            getUserSpotState: vi.fn(),
            pairExists: vi.fn(),
        } as unknown as TradingApiPort;

        step = new AdvancedUpperStep(mockTradingApi);
    });

    describe('buildView', () => {
        it('should show current price in prompt when symbol exists', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);

            const view = await step.buildView(ctx);

            expect(view.body).toContain('50000');
        });

        it('should handle price fetch error gracefully', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API error'));

            const view = await step.buildView(ctx);

            expect(view.body).toBeTruthy();
        });

        it('should show prompt without price when symbol is missing', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const view = await step.buildView(ctx);

            expect(mockTradingApi.getCurrentPrice).not.toHaveBeenCalled();
            expect(view.body).toBeTruthy();
        });

        it('includes Back and Cancel buttons in keyboard', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const view = await step.buildView(ctx);

            const navRow = view.keyboard.find(
                (r) =>
                    r.some((b) => b.action === 'create_grid:back') &&
                    r.some((b) => b.action === 'create_grid:cancel'),
            );
            expect(navRow).toBeDefined();
        });

        it('includes percent presets when current price is available', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);

            const view = await step.buildView(ctx);

            const presetRow = view.keyboard.find((r) =>
                r.some((b) => b.action?.startsWith('create_grid:upper:')),
            );
            expect(presetRow).toBeDefined();
        });

        it('returns plain prompt body regardless of pendingError (error prepend is handled by BoardRenderer)', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { pendingError: '❌ Invalid price' };

            const view = await step.buildView(ctx);

            expect(view.body).toBeTruthy();
            expect(view.body).not.toContain('❌ Invalid price');
        });
    });

    describe('rollbackState', () => {
        it('deletes upperPrice from session', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 55000 };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.upperPrice).toBeUndefined();
        });

        it('does nothing when createGrid is undefined', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            expect(() => step.rollbackState(ctx)).not.toThrow();
        });
    });

    describe('handleUpperPreset', () => {
        it('returns null and sets pendingError when raw is "custom"', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleUpperPreset(ctx, 'custom');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('computes price from percentage and advances to Lower', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);

            const result = await step.handleUpperPreset(ctx, '10');

            expect(result).toEqual({ nextStep: SceneStep.Lower });
            expect(ctx.session.createGrid?.upperPrice).toBe(55000);
        });
    });

    describe('handleTextInput', () => {
        it('should accept valid upper price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleTextInput(ctx, '55000');

            expect(result).toEqual({ nextStep: SceneStep.Lower });
            expect(ctx.session.createGrid?.upperPrice).toBe(55000);
        });

        it('should set pendingError and return null for zero price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleTextInput(ctx, '0');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should set pendingError and return null for non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleTextInput(ctx, 'abc');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should return null if session not initialized', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            const result = await step.handleTextInput(ctx, '55000');

            expect(result).toBeNull();
        });
    });

    function createMockContext(): BotContext {
        const session = { createGrid: {} };
        return {
            session,
            scene: { leave: vi.fn() },
        } as unknown as BotContext;
    }
});
