import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WizardNavigator } from './wizard-navigator';
import { BoardRenderer } from './board-renderer';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { WizardStep } from './wizard-step';
import { StepView } from './step-view';

describe('WizardNavigator', () => {
    let navigator: WizardNavigator;
    let mockBoardRenderer: BoardRenderer;
    let mockPairStep: WizardStep;
    let mockModeStep: WizardStep;

    const pairView: StepView = {
        body: 'Select pair',
        keyboard: [[{ text: 'Cancel', action: 'create_grid:cancel' }]],
    };

    const modeView: StepView = {
        body: 'Select mode',
        keyboard: [[{ text: 'Quick', action: 'create_grid:mode:quick' }]],
    };

    beforeEach(() => {
        mockBoardRenderer = {
            render: vi.fn().mockResolvedValue(undefined),
        } as unknown as BoardRenderer;

        mockPairStep = {
            id: SceneStep.Pair,
            buildView: vi.fn().mockResolvedValue(pairView),
            rollbackState: vi.fn(),
        } as unknown as WizardStep;

        mockModeStep = {
            id: SceneStep.Mode,
            buildView: vi.fn().mockResolvedValue(modeView),
            rollbackState: vi.fn(),
        } as unknown as WizardStep;

        navigator = new WizardNavigator(mockBoardRenderer);
        navigator.registerStep(mockPairStep);
        navigator.registerStep(mockModeStep);
    });

    function createMockContext(): BotContext {
        return {
            session: {},
            scene: { leave: vi.fn() },
            reply: vi.fn().mockResolvedValue({}),
            telegram: {
                deleteMessage: vi.fn().mockResolvedValue(undefined),
            },
        } as unknown as BotContext;
    }

    describe('start', () => {
        it('initializes session and renders first step via boardRenderer', async () => {
            const ctx = createMockContext();

            await navigator.start(ctx);

            expect(ctx.session.createGrid).toMatchObject({
                currentStep: SceneStep.Pair,
                stepHistory: [],
            });
            expect(mockPairStep.buildView).toHaveBeenCalledWith(ctx);
            expect(mockBoardRenderer.render).toHaveBeenCalledWith(ctx, pairView);
        });
    });

    describe('completeStep', () => {
        it('returns early when currentStep is falsy', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { stepHistory: [] };

            await navigator.completeStep(ctx, { nextStep: SceneStep.Mode });

            expect(mockBoardRenderer.render).not.toHaveBeenCalled();
        });

        it('advances step, pushes history, and renders next step', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
                stepHistory: [],
            };

            await navigator.completeStep(ctx, { nextStep: SceneStep.Mode });

            expect(ctx.session.createGrid?.currentStep).toBe(SceneStep.Mode);
            expect(ctx.session.createGrid?.stepHistory).toContain(SceneStep.Pair);
            expect(mockModeStep.buildView).toHaveBeenCalledWith(ctx);
            expect(mockBoardRenderer.render).toHaveBeenCalledWith(ctx, modeView);
        });

        it('initializes stepHistory if undefined', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
            };

            await navigator.completeStep(ctx, { nextStep: SceneStep.Mode });

            expect(ctx.session.createGrid?.stepHistory).toContain(SceneStep.Pair);
        });
    });

    describe('handleBack', () => {
        it('navigates to previous step and rolls back state', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Mode,
                stepHistory: [SceneStep.Pair],
            };

            await navigator.handleBack(ctx);

            expect(mockPairStep.rollbackState).toHaveBeenCalledWith(ctx);
            expect(ctx.session.createGrid?.currentStep).toBe(SceneStep.Pair);
            expect(mockPairStep.buildView).toHaveBeenCalledWith(ctx);
            expect(mockBoardRenderer.render).toHaveBeenCalledWith(ctx, pairView);
        });

        it('clears pendingError on back navigation', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Mode,
                stepHistory: [SceneStep.Pair],
                pendingError: 'Some error',
            };

            await navigator.handleBack(ctx);

            expect(ctx.session.createGrid?.pendingError).toBeUndefined();
        });

        it('does nothing when stepHistory is empty', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
                stepHistory: [],
            };

            await navigator.handleBack(ctx);

            expect(mockBoardRenderer.render).not.toHaveBeenCalled();
        });

        it('does nothing when createGrid is missing', async () => {
            const ctx = createMockContext();

            await navigator.handleBack(ctx);

            expect(mockBoardRenderer.render).not.toHaveBeenCalled();
        });
    });

    describe('handleCancel', () => {
        it('deletes board message, clears session, and leaves scene', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
                stepHistory: [],
                boardChatId: 10,
                boardMessageId: 20,
            };

            await navigator.handleCancel(ctx);

            expect(ctx.telegram.deleteMessage).toHaveBeenCalledWith(10, 20);
            expect(ctx.session.createGrid).toBeUndefined();
            expect(ctx.scene.leave).toHaveBeenCalled();
        });

        it('skips board delete when boardMessageId is not set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
                stepHistory: [],
            };

            await navigator.handleCancel(ctx);

            expect(ctx.telegram.deleteMessage).not.toHaveBeenCalled();
            expect(ctx.session.createGrid).toBeUndefined();
        });

        it('sends cancellation message when stepHistory is non-empty', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Mode,
                stepHistory: [SceneStep.Pair],
            };

            await navigator.handleCancel(ctx);

            expect(ctx.reply).toHaveBeenCalled();
            expect(ctx.session.createGrid).toBeUndefined();
        });

        it('does not send cancellation message when stepHistory is empty', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
                stepHistory: [],
            };

            await navigator.handleCancel(ctx);

            expect(ctx.reply).not.toHaveBeenCalled();
        });

        it('handles board delete failure gracefully', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
                stepHistory: [],
                boardChatId: 10,
                boardMessageId: 20,
            };
            vi.mocked(ctx.telegram.deleteMessage).mockRejectedValue(new Error('message not found'));

            await expect(navigator.handleCancel(ctx)).resolves.not.toThrow();
        });
    });

    describe('renderCurrentStep', () => {
        it('calls buildView and boardRenderer.render when step has buildView', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
                stepHistory: [],
            };

            await navigator.renderCurrentStep(ctx);

            expect(mockPairStep.buildView).toHaveBeenCalledWith(ctx);
            expect(mockBoardRenderer.render).toHaveBeenCalledWith(ctx, pairView);
        });

        it('clears pendingError after rendering', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Pair,
                stepHistory: [],
                pendingError: 'some error',
            };

            await navigator.renderCurrentStep(ctx);

            expect(ctx.session.createGrid?.pendingError).toBeUndefined();
        });

        it('does nothing when currentStep is not set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { stepHistory: [] };

            await navigator.renderCurrentStep(ctx);

            expect(mockBoardRenderer.render).not.toHaveBeenCalled();
        });

        it('does nothing when step is not registered', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                currentStep: SceneStep.Quick,
                stepHistory: [],
            };

            await navigator.renderCurrentStep(ctx);

            expect(mockBoardRenderer.render).not.toHaveBeenCalled();
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

    describe('getStepInstance', () => {
        it('returns registered step by id', () => {
            expect(navigator.getStepInstance(SceneStep.Pair)).toBe(mockPairStep);
            expect(navigator.getStepInstance(SceneStep.Mode)).toBe(mockModeStep);
        });

        it('returns undefined for unregistered step', () => {
            expect(navigator.getStepInstance(SceneStep.Quick)).toBeUndefined();
        });
    });
});
