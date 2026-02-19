import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WizardNavigator } from './wizard-navigator';
import { WizardMessageManager } from './wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { WizardStep } from './wizard-step';

describe('WizardNavigator', () => {
    let navigator: WizardNavigator;
    let mockMessageManager: WizardMessageManager;
    let mockPairStep: WizardStep;
    let mockModeStep: WizardStep;

    beforeEach(() => {
        mockMessageManager = {
            initStep: vi.fn(),
            deleteEnterMessages: vi.fn().mockResolvedValue(undefined),
            deleteConfirmationMessages: vi.fn().mockResolvedValue(undefined),
            sendConfirmation: vi.fn().mockResolvedValue(undefined),
            deleteAllMessages: vi.fn().mockResolvedValue(undefined),
        } as unknown as WizardMessageManager;

        mockPairStep = {
            id: SceneStep.Pair,
            enter: vi.fn().mockResolvedValue(undefined),
            rollbackState: vi.fn(),
        } as unknown as WizardStep;

        mockModeStep = {
            id: SceneStep.Mode,
            enter: vi.fn().mockResolvedValue(undefined),
            rollbackState: vi.fn(),
        } as unknown as WizardStep;

        navigator = new WizardNavigator(mockMessageManager);
        navigator.registerStep(mockPairStep);
        navigator.registerStep(mockModeStep);
    });

    function createMockContext(): BotContext {
        return {
            session: {},
            scene: { leave: vi.fn() },
            reply: vi.fn().mockResolvedValue({}),
        } as unknown as BotContext;
    }

    describe('start', () => {
        it('initializes session and calls first step enter', async () => {
            const ctx = createMockContext();

            await navigator.start(ctx);

            expect(ctx.session.createGrid).toMatchObject({
                currentStep: SceneStep.Pair,
                stepHistory: [],
                stepMessages: {},
            });
            expect(mockMessageManager.initStep).toHaveBeenCalledWith(ctx, SceneStep.Pair);
            expect(mockPairStep.enter).toHaveBeenCalledWith(ctx);
        });
    });

    describe('completeStep', () => {
        it('deletes enter messages, sends confirmations, and navigates to next step', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
                stepHistory: [],
                stepMessages: {},
            };

            await navigator.completeStep(ctx, {
                nextStep: SceneStep.Mode,
                confirmations: ['Pair selected!'],
            });

            expect(mockMessageManager.deleteEnterMessages).toHaveBeenCalledWith(
                ctx,
                SceneStep.Pair,
            );
            expect(mockMessageManager.sendConfirmation).toHaveBeenCalledWith(
                ctx,
                SceneStep.Pair,
                'Pair selected!',
            );
            expect(ctx.session.createGrid?.currentStep).toBe(SceneStep.Mode);
            expect(ctx.session.createGrid?.stepHistory).toContain(SceneStep.Pair);
            expect(mockModeStep.enter).toHaveBeenCalledWith(ctx);
        });
    });

    describe('handleBack', () => {
        it('navigates to previous step and rolls back state', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Mode,
                stepHistory: [SceneStep.Pair],
                stepMessages: {
                    [SceneStep.Mode]: { enterMessageIds: [], confirmationMessageIds: [] },
                },
            };

            await navigator.handleBack(ctx);

            expect(mockMessageManager.deleteEnterMessages).toHaveBeenCalledWith(
                ctx,
                SceneStep.Mode,
            );
            expect(mockMessageManager.deleteConfirmationMessages).toHaveBeenCalledWith(
                ctx,
                SceneStep.Pair,
            );
            expect(mockPairStep.rollbackState).toHaveBeenCalledWith(ctx);
            expect(ctx.session.createGrid?.currentStep).toBe(SceneStep.Pair);
            expect(mockPairStep.enter).toHaveBeenCalledWith(ctx);
        });

        it('re-enters current step when showingValidationError is true', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
                stepHistory: [],
                stepMessages: {},
                showingValidationError: true,
            };

            await navigator.handleBack(ctx);

            expect(ctx.session.createGrid?.showingValidationError).toBe(false);
            expect(mockPairStep.enter).toHaveBeenCalledWith(ctx);
            expect(mockMessageManager.deleteConfirmationMessages).not.toHaveBeenCalled();
        });

        it('does nothing when stepHistory is empty and no validation error', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
                stepHistory: [],
                stepMessages: {},
            };

            await navigator.handleBack(ctx);

            expect(mockPairStep.enter).not.toHaveBeenCalled();
            expect(mockModeStep.enter).not.toHaveBeenCalled();
        });
    });

    describe('handleCancel', () => {
        it('deletes all messages, clears session, and leaves scene', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
                stepHistory: [],
                stepMessages: {},
            };

            await navigator.handleCancel(ctx);

            expect(mockMessageManager.deleteAllMessages).toHaveBeenCalledWith(ctx);
            expect(ctx.session.createGrid).toBeUndefined();
            expect(ctx.scene.leave).toHaveBeenCalled();
        });
    });

    describe('getCurrentStep', () => {
        it('returns current step from session', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { currentStep: SceneStep.Mode };

            expect(navigator.getCurrentStep(ctx)).toBe(SceneStep.Mode);
        });

        it('returns null when no createGrid session', () => {
            const ctx = createMockContext();

            expect(navigator.getCurrentStep(ctx)).toBeNull();
        });
    });
});
