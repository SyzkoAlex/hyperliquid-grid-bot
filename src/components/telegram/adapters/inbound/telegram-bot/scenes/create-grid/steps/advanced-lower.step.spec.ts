import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedLowerStep } from './advanced-lower.step';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';

describe('AdvancedLowerStep', () => {
    let step: AdvancedLowerStep;
    let mockMessageManager: WizardMessageManager;

    beforeEach(() => {
        mockMessageManager = {
            sendEnterMessage: vi.fn(),
        } as unknown as WizardMessageManager;

        step = new AdvancedLowerStep(mockMessageManager);
    });

    describe('handleTextInput', () => {
        it('should accept valid lower price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 55000 };

            const result = await step.handleTextInput(ctx, '45000');

            expect(result).toEqual({
                nextStep: SceneStep.Levels,
                confirmations: ['✅ Lower price set: 45000'],
            });
            expect(ctx.session.createGrid?.lowerPrice).toBe(45000);
        });

        it('should reject lower price >= upper price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 50000 };

            const result = await step.handleTextInput(ctx, '55000');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should reject negative price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 50000 };

            const result = await step.handleTextInput(ctx, '-100');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { upperPrice: 50000 };

            const result = await step.handleTextInput(ctx, 'abc');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
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
