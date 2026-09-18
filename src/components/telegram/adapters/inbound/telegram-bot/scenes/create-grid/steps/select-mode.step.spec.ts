import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectModeStep } from './select-mode.step';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';
import { SceneStep } from '../create-grid-scene-step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { PredictionApiPort } from '@components/prediction/api/prediction-api.port';

describe('SelectModeStep', () => {
    let step: SelectModeStep;
    let mockTradingApi: TradingApiPort;
    let mockPredictionApi: PredictionApiPort;

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn().mockResolvedValue(43.89),
        } as unknown as TradingApiPort;
        mockPredictionApi = {
            isAvailable: vi.fn().mockReturnValue(false),
            getBestGrid: vi.fn(),
        } as unknown as PredictionApiPort;
        step = new SelectModeStep(mockTradingApi, mockPredictionApi);
    });

    describe('buildView', () => {
        it('returns body with PROMPT text', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            expect(view.body).toBeTruthy();
        });

        it('returns keyboard with Quick and Advanced mode buttons when AI is unavailable', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const quickRow = view.keyboard.find((r) =>
                r.some((b) => b.action === 'create_grid:mode:quick'),
            );
            const advancedRow = view.keyboard.find((r) =>
                r.some((b) => b.action === 'create_grid:mode:advanced'),
            );
            const aiRow = view.keyboard.find((r) =>
                r.some((b) => b.action === 'create_grid:mode:ai'),
            );

            expect(quickRow).toBeDefined();
            expect(advancedRow).toBeDefined();
            expect(aiRow).toBeUndefined();
        });

        it('replaces the Quick button with AI mode when prediction is available', async () => {
            vi.mocked(mockPredictionApi.isAvailable).mockReturnValue(true);
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const flat = view.keyboard.flat();
            expect(flat.some((b) => b.action === 'create_grid:mode:ai')).toBe(true);
            expect(flat.some((b) => b.action === 'create_grid:mode:quick')).toBe(false);
            expect(flat.some((b) => b.action === 'create_grid:mode:advanced')).toBe(true);
        });

        it('describes AI mode in the body when prediction is available', async () => {
            vi.mocked(mockPredictionApi.isAvailable).mockReturnValue(true);
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            expect(view.body).toContain('AI mode');
            expect(view.body).not.toContain('Quick start');
        });

        it('includes Back and Cancel buttons', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const navRow = view.keyboard.find(
                (r) =>
                    r.some((b) => b.action === 'create_grid:back') &&
                    r.some((b) => b.action === 'create_grid:cancel'),
            );

            expect(navRow).toBeDefined();
        });
    });

    describe('rollbackState', () => {
        it('deletes mode from session', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { mode: CreateGridMode.Quick };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.mode).toBeUndefined();
        });

        it('does nothing when createGrid is undefined', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            expect(() => step.rollbackState(ctx)).not.toThrow();
        });
    });

    describe('handleModeSelection', () => {
        it('should set quick mode in session and return nextStep Quick', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleModeSelection(ctx, CreateGridMode.Quick);

            expect(result).toEqual({ nextStep: SceneStep.Quick });
            expect(ctx.session.createGrid!.mode).toBe(CreateGridMode.Quick);
        });

        it('should set ai mode in session and return nextStep Ai', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            const result = await step.handleModeSelection(ctx, CreateGridMode.Ai);

            expect(result).toEqual({ nextStep: SceneStep.Ai });
            expect(ctx.session.createGrid!.mode).toBe(CreateGridMode.Ai);
        });

        it('should set advanced mode in session and return nextStep Upper', async () => {
            const ctx = createMockContext();

            const result = await step.handleModeSelection(ctx, CreateGridMode.Advanced);

            expect(result).toEqual({ nextStep: SceneStep.Upper });
            expect(ctx.session.createGrid!.mode).toBe(CreateGridMode.Advanced);
        });

        it('should initialize createGrid if not exists', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            await step.handleModeSelection(ctx, CreateGridMode.Advanced);

            expect(ctx.session.createGrid).toBeDefined();
            expect(ctx.session.createGrid!.mode).toBe(CreateGridMode.Advanced);
        });

        it('stores currentPrice in session when symbol is set and price fetch succeeds', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            await step.handleModeSelection(ctx, CreateGridMode.Quick);

            expect(ctx.session.createGrid?.currentPrice).toBe(43.89);
        });

        it('does not store currentPrice when price fetch fails', async () => {
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValueOnce(new Error('network'));
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };

            await step.handleModeSelection(ctx, CreateGridMode.Quick);

            expect(ctx.session.createGrid?.currentPrice).toBeUndefined();
        });

        it('does not call getCurrentPrice when symbol is not set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { mode: CreateGridMode.Quick };

            await step.handleModeSelection(ctx, CreateGridMode.Quick);

            expect(mockTradingApi.getCurrentPrice).not.toHaveBeenCalled();
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
