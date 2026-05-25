import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectModeStep } from './select-mode.step';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';
import { SceneStep } from '../create-grid-scene-step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';

describe('SelectModeStep', () => {
    let step: SelectModeStep;
    let mockTradingApi: TradingApiPort;

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn().mockResolvedValue(43.89),
        } as unknown as TradingApiPort;
        step = new SelectModeStep(mockTradingApi);
    });

    describe('buildView', () => {
        it('returns body with PROMPT text', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            expect(view.body).toBeTruthy();
        });

        it('returns keyboard with Quick and Advanced mode buttons', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const quickRow = view.keyboard.find((r) =>
                r.some((b) => b.action === 'create_grid:mode:quick'),
            );
            const advancedRow = view.keyboard.find((r) =>
                r.some((b) => b.action === 'create_grid:mode:advanced'),
            );

            expect(quickRow).toBeDefined();
            expect(advancedRow).toBeDefined();
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
