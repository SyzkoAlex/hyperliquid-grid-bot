import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedOrdersStep } from './advanced-orders.step';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';

describe('AdvancedOrdersStep', () => {
    let step: AdvancedOrdersStep;

    beforeEach(() => {
        step = new AdvancedOrdersStep();
    });

    describe('buildView', () => {
        it('returns body with prompt text', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            expect(view.body).toContain('grid orders');
        });

        it('returns keyboard with preset orders and navigation buttons', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const hasPreset = view.keyboard.some((r) =>
                r.some((b) => b.action?.startsWith('create_grid:orders:')),
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

            const hasOrders5 = view.keyboard.some((r) => r.some((b) => b.text === '5'));
            expect(hasOrders5).toBe(true);
        });

        it('returns plain prompt body regardless of pendingError (error prepend is handled by BoardRenderer)', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { pendingError: '❌ Invalid orders' };

            const view = await step.buildView(ctx);

            expect(view.body).toContain('grid orders');
            expect(view.body).not.toContain('❌ Invalid orders');
        });
    });

    describe('rollbackState', () => {
        it('deletes orderCount from session', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { orderCount: 10 };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.orderCount).toBeUndefined();
        });

        it('does nothing when createGrid is undefined', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            expect(() => step.rollbackState(ctx)).not.toThrow();
        });
    });

    describe('handleOrdersSelection', () => {
        it('should accept valid order count', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleOrdersSelection(ctx, 10);

            expect(result).toEqual({ nextStep: SceneStep.Investment });
            expect(ctx.session.createGrid?.orderCount).toBe(10);
        });

        it('should set pendingError and return null for orders below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleOrdersSelection(ctx, 4);

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should set pendingError and return null for orders above maximum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleOrdersSelection(ctx, 101);

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should return null if no lower price set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleOrdersSelection(ctx, 10);

            expect(result).toBeNull();
        });
    });

    describe('handleTextInput', () => {
        it('should parse and validate text input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleTextInput(ctx, '15');

            expect(result).toEqual({ nextStep: SceneStep.Investment });
            expect(ctx.session.createGrid?.orderCount).toBe(15);
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
