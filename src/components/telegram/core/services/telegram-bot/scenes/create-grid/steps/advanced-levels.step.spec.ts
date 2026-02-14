import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedLevelsStep } from './advanced-levels.step';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';

describe('AdvancedLevelsStep', () => {
    let step: AdvancedLevelsStep;
    let mockMessageManager: WizardMessageManager;

    beforeEach(() => {
        mockMessageManager = {
            sendEnterMessage: vi.fn(),
        } as unknown as WizardMessageManager;

        step = new AdvancedLevelsStep(mockMessageManager);
    });

    describe('handleLevelsSelection', () => {
        it('should accept valid level count', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleLevelsSelection(ctx, 10);

            expect(result).toEqual({
                nextStep: SceneStep.Investment,
                confirmations: ['✅ Grid levels set: 10'],
            });
            expect(ctx.session.createGrid?.levels).toBe(10);
        });

        it('should reject levels below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleLevelsSelection(ctx, 2);

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should reject levels above maximum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleLevelsSelection(ctx, 101);

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
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

            expect(result).toEqual({
                nextStep: SceneStep.Investment,
                confirmations: ['✅ Grid levels set: 15'],
            });
            expect(ctx.session.createGrid?.levels).toBe(15);
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { lowerPrice: 45000 };

            const result = await step.handleTextInput(ctx, 'abc');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
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
