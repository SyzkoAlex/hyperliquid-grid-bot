import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedLevelsStep } from './advanced-levels.step';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';

describe('AdvancedLevelsStep', () => {
    let step: AdvancedLevelsStep;

    beforeEach(() => {
        step = new AdvancedLevelsStep();
    });

    describe('buildView', () => {
        it('returns body with prompt text', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            expect(view.body).toContain('grid levels');
        });

        it('returns keyboard with preset levels and navigation buttons', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const hasPreset = view.keyboard.some((r) =>
                r.some((b) => b.action?.startsWith('create_grid:levels:')),
            );
            const hasNav = view.keyboard.some(
                (r) =>
                    r.some((b) => b.action === 'create_grid:back') &&
                    r.some((b) => b.action === 'create_grid:cancel'),
            );
            expect(hasPreset).toBe(true);
            expect(hasNav).toBe(true);
        });

        it('has "5" as one of the preset buttons', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const hasLevel5 = view.keyboard.some((r) => r.some((b) => b.text === '5'));
            expect(hasLevel5).toBe(true);
        });

        it('returns plain prompt body regardless of pendingError (error prepend is handled by BoardRenderer)', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { pendingError: '❌ Invalid levels' };

            const view = await step.buildView(ctx);

            expect(view.body).toContain('grid levels');
            expect(view.body).not.toContain('❌ Invalid levels');
        });
    });

    describe('rollbackState', () => {
        it('deletes levels from session', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { levels: 10 };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.levels).toBeUndefined();
        });

        it('does nothing when createGrid is undefined', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            expect(() => step.rollbackState(ctx)).not.toThrow();
        });
    });

    describe('handleLevelsSelection', () => {
        it('should accept valid level count', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleLevelsSelection(ctx, 10);

            expect(result).toEqual({ nextStep: SceneStep.Investment });
            expect(ctx.session.createGrid?.levels).toBe(10);
        });

        it('should set pendingError and return null for levels below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleLevelsSelection(ctx, 2);

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should set pendingError and return null for levels above maximum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleLevelsSelection(ctx, 101);

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should return null if no lower price set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleLevelsSelection(ctx, 10);

            expect(result).toBeNull();
        });
    });

    describe('handleTextInput', () => {
        it('should parse and validate text input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleTextInput(ctx, '15');

            expect(result).toEqual({ nextStep: SceneStep.Investment });
            expect(ctx.session.createGrid?.levels).toBe(15);
        });

        it('should set pendingError for non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleTextInput(ctx, 'abc');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
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
