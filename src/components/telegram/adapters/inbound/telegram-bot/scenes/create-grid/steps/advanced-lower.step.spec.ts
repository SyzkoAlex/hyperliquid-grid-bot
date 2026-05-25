import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedLowerStep } from './advanced-lower.step';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';

describe('AdvancedLowerStep', () => {
    let step: AdvancedLowerStep;

    beforeEach(() => {
        step = new AdvancedLowerStep();
    });

    describe('buildView', () => {
        it('returns keyboard with Back and Cancel buttons', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 55000 };

            const view = await step.buildView(ctx);

            const navRow = view.keyboard.find(
                (r) =>
                    r.some((b) => b.action === 'create_grid:back') &&
                    r.some((b) => b.action === 'create_grid:cancel'),
            );
            expect(navRow).toBeDefined();
        });

        it('includes percentage presets when currentPrice is set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 55000, currentPrice: 50000 };

            const view = await step.buildView(ctx);

            const presetRow = view.keyboard.find((r) =>
                r.some((b) => b.action?.startsWith('create_grid:lower:')),
            );
            expect(presetRow).toBeDefined();
        });

        it('shows no presets when currentPrice is absent', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 55000 };

            const view = await step.buildView(ctx);

            const presetRow = view.keyboard.find((r) =>
                r.some(
                    (b) =>
                        b.action?.startsWith('create_grid:lower:') &&
                        b.action !== 'create_grid:lower:custom',
                ),
            );
            expect(presetRow).toBeUndefined();
        });

        it('returns plain prompt body regardless of pendingError (error prepend is handled by BoardRenderer)', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 55000, pendingError: '❌ Bad price' };

            const view = await step.buildView(ctx);

            expect(view.body).toBeTruthy();
            expect(view.body).not.toContain('❌ Bad price');
        });
    });

    describe('rollbackState', () => {
        it('deletes lowerPrice from session', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.lowerPrice).toBeUndefined();
        });

        it('does nothing when createGrid is undefined', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            expect(() => step.rollbackState(ctx)).not.toThrow();
        });
    });

    describe('handleLowerPreset', () => {
        it('returns null and sets pendingError when raw is "custom"', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 50000, currentPrice: 45000 };

            const result = await step.handleLowerPreset(ctx, 'custom');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('computes lower price from currentPrice percentage and advances to Levels', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 55000, currentPrice: 50000 };

            const result = await step.handleLowerPreset(ctx, '10');

            expect(result).toEqual({ nextStep: SceneStep.Levels });
            // -10% of currentPrice(50000) = 45000
            expect(ctx.session.createGrid?.lowerPrice).toBe(45000);
        });

        it('falls back to upperPrice when currentPrice is absent', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 50000 };

            const result = await step.handleLowerPreset(ctx, '10');

            expect(result).toEqual({ nextStep: SceneStep.Levels });
            // -10% of upperPrice(50000) = 45000
            expect(ctx.session.createGrid?.lowerPrice).toBe(45000);
        });

        it('returns null when neither currentPrice nor upperPrice is set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleLowerPreset(ctx, '10');

            expect(result).toBeNull();
        });
    });

    describe('handleTextInput', () => {
        it('should accept valid lower price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 55000 };

            const result = await step.handleTextInput(ctx, '45000');

            expect(result).toEqual({ nextStep: SceneStep.Levels });
            expect(ctx.session.createGrid?.lowerPrice).toBe(45000);
        });

        it('should set pendingError when lower price >= upper price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 50000 };

            const result = await step.handleTextInput(ctx, '55000');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should set pendingError for negative price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 50000 };

            const result = await step.handleTextInput(ctx, '-100');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should set pendingError for non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 50000 };

            const result = await step.handleTextInput(ctx, 'abc');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should return null if no upper price set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleTextInput(ctx, '45000');

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
