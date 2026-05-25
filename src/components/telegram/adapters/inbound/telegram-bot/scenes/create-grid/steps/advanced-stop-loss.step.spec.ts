import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdvancedStopLossStep } from './advanced-stop-loss.step';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';

function createMockContext(
    overrides: { lowerPrice?: number; pendingError?: string } = {},
): BotContext {
    return {
        session: {
            createGrid: {
                lowerPrice: overrides.lowerPrice ?? 2000,
                pendingError: overrides.pendingError as string | undefined,
                stopLossEnabled: undefined as boolean | undefined,
                stopLossPrice: undefined as number | undefined,
            },
        },
        answerCbQuery: vi.fn().mockResolvedValue(undefined),
    } as unknown as BotContext;
}

describe('AdvancedStopLossStep', () => {
    let sut: AdvancedStopLossStep;

    beforeEach(() => {
        sut = new AdvancedStopLossStep();
    });

    describe('buildView', () => {
        it('returns body with stop-loss prompt', async () => {
            const ctx = createMockContext({ lowerPrice: 2000 });

            const view = await sut.buildView(ctx);

            expect(view.body).toContain('Stop-Loss');
        });

        it('includes Skip and Custom buttons', async () => {
            const ctx = createMockContext({ lowerPrice: 2000 });

            const view = await sut.buildView(ctx);

            const hasSkip = view.keyboard.some((r) =>
                r.some((b) => b.action === 'create_grid:stop_loss:off'),
            );
            const hasCustom = view.keyboard.some((r) =>
                r.some((b) => b.action === 'create_grid:sl:custom'),
            );
            expect(hasSkip).toBe(true);
            expect(hasCustom).toBe(true);
        });

        it('includes percentage presets when lowerPrice is set', async () => {
            const ctx = createMockContext({ lowerPrice: 2000 });

            const view = await sut.buildView(ctx);

            const hasPresets = view.keyboard.some((r) =>
                r.some((b) => b.action?.startsWith('create_grid:sl:')),
            );
            expect(hasPresets).toBe(true);
        });

        it('returns plain prompt body regardless of pendingError (error prepend is handled by BoardRenderer)', async () => {
            const ctx = createMockContext({ lowerPrice: 2000, pendingError: '❌ Invalid SL' });

            const view = await sut.buildView(ctx);

            expect(view.body).toContain('Stop-Loss');
            expect(view.body).not.toContain('❌ Invalid SL');
        });
    });

    describe('handleStopLossPreset', () => {
        it('returns null and sets pendingError when key is "custom"', async () => {
            const ctx = createMockContext({ lowerPrice: 2000 });

            const result = await sut.handleStopLossPreset(ctx, 'custom');

            expect(result).toBeNull();
            expect((ctx.session.createGrid as { pendingError?: string }).pendingError).toBeTruthy();
        });

        it('computes stop-loss price from percentage and advances to Preview', async () => {
            const ctx = createMockContext({ lowerPrice: 2000 });

            const result = await sut.handleStopLossPreset(ctx, '10');

            expect(result).toEqual({ nextStep: SceneStep.Preview });
            expect(ctx.session.createGrid?.stopLossPrice).toBe(1800);
            expect(ctx.session.createGrid?.stopLossEnabled).toBe(true);
        });
    });

    describe('handleTextInput', () => {
        it('returns null and sets pendingError when price is <= 0', async () => {
            const ctx = createMockContext();
            const result = await sut.handleTextInput(ctx, '0');
            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('returns null and sets pendingError when price is NaN', async () => {
            const ctx = createMockContext();
            const result = await sut.handleTextInput(ctx, 'abc');
            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('returns null when price >= lowerPrice', async () => {
            const ctx = createMockContext({ lowerPrice: 2000 });
            const result = await sut.handleTextInput(ctx, '2000');
            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('returns null when price is too close to lowerPrice (< 0.5% buffer)', async () => {
            const ctx = createMockContext({ lowerPrice: 2000 });
            const result = await sut.handleTextInput(ctx, '1992');
            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('returns StepResult with nextStep=Preview when price is valid', async () => {
            const ctx = createMockContext({ lowerPrice: 2000 });
            const result = await sut.handleTextInput(ctx, '1980');
            expect(result).not.toBeNull();
            expect(result!.nextStep).toBe(SceneStep.Preview);
            expect(ctx.session.createGrid?.stopLossEnabled).toBe(true);
            expect(ctx.session.createGrid?.stopLossPrice).toBe(1980);
        });
    });

    describe('handleSkip', () => {
        it('sets stopLossEnabled=false and advances to Preview', async () => {
            const ctx = createMockContext();
            const result = await sut.handleSkip(ctx);
            expect(result!.nextStep).toBe(SceneStep.Preview);
            expect(ctx.session.createGrid?.stopLossEnabled).toBe(false);
        });
    });

    describe('rollbackState', () => {
        it('clears stopLossEnabled and stopLossPrice from session', () => {
            const ctx = createMockContext();
            ctx.session.createGrid!.stopLossEnabled = true;
            ctx.session.createGrid!.stopLossPrice = 1980;
            sut.rollbackState(ctx);
            expect(ctx.session.createGrid?.stopLossEnabled).toBeUndefined();
            expect(ctx.session.createGrid?.stopLossPrice).toBeUndefined();
        });
    });
});
