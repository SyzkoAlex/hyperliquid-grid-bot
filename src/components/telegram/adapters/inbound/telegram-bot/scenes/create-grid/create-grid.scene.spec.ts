import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scenes } from 'telegraf';
import { CreateGridSceneHandler } from './create-grid.scene';
import { WizardNavigator } from './wizard/wizard-navigator';
import { WizardMessageManager } from './wizard/wizard-message-manager';
import { SelectPairStep } from './steps/select-pair.step';
import { SelectModeStep } from './steps/select-mode.step';
import { QuickStartStep } from './steps/quick-start.step';
import { AdvancedUpperStep } from './steps/advanced-upper.step';
import { AdvancedLowerStep } from './steps/advanced-lower.step';
import { AdvancedLevelsStep } from './steps/advanced-levels.step';
import { AdvancedInvestmentStep } from './steps/advanced-investment.step';
import { AdvancedPreviewStep } from './steps/advanced-preview.step';
import { ConfirmStep } from './steps/confirm.step';
import { BotContext } from '../../types/bot-context';
import { SceneStep } from './create-grid-scene-step';
import { CreateGridMode } from './create-grid-mode';

describe('CreateGridSceneHandler', () => {
    let handler: CreateGridSceneHandler;
    let mockNavigator: WizardNavigator;
    let mockMessageManager: WizardMessageManager;
    let mockConfirmStep: ConfirmStep;
    let mockSelectPairStep: SelectPairStep;
    let mockSelectModeStep: SelectModeStep;
    let mockAdvancedLevelsStep: AdvancedLevelsStep;

    beforeEach(() => {
        mockNavigator = {
            start: vi.fn().mockResolvedValue(undefined),
            completeStep: vi.fn().mockResolvedValue(undefined),
            handleBack: vi.fn().mockResolvedValue(undefined),
            handleCancel: vi.fn().mockResolvedValue(undefined),
            getCurrentStep: vi.fn().mockReturnValue(null),
            getStepInstance: vi.fn().mockReturnValue(undefined),
            registerStep: vi.fn(),
        } as unknown as WizardNavigator;

        mockMessageManager = {
            deleteAllMessages: vi.fn().mockResolvedValue(undefined),
        } as unknown as WizardMessageManager;

        mockConfirmStep = {
            execute: vi.fn().mockResolvedValue(undefined),
        } as unknown as ConfirmStep;

        mockSelectPairStep = {
            id: SceneStep.Pair,
            enter: vi.fn().mockResolvedValue(undefined),
            rollbackState: vi.fn(),
            handlePairSelection: vi.fn().mockResolvedValue(null),
            handleOtherPair: vi.fn().mockResolvedValue(undefined),
            handleTextInput: vi.fn().mockResolvedValue(null),
        } as unknown as SelectPairStep;

        mockSelectModeStep = {
            id: SceneStep.Mode,
            enter: vi.fn().mockResolvedValue(undefined),
            rollbackState: vi.fn(),
            handleModeSelection: vi.fn().mockResolvedValue(null),
        } as unknown as SelectModeStep;

        mockAdvancedLevelsStep = {
            id: SceneStep.Levels,
            enter: vi.fn().mockResolvedValue(undefined),
            rollbackState: vi.fn(),
            handleLevelsSelection: vi.fn().mockResolvedValue(null),
        } as unknown as AdvancedLevelsStep;

        const makeStep = (id: SceneStep) =>
            ({
                id,
                enter: vi.fn().mockResolvedValue(undefined),
                rollbackState: vi.fn(),
                handleTextInput: vi.fn().mockResolvedValue(null),
            }) as unknown as WizardStep;

        handler = new CreateGridSceneHandler(
            mockNavigator,
            mockMessageManager,
            mockSelectPairStep,
            mockSelectModeStep,
            makeStep(SceneStep.Quick) as unknown as QuickStartStep,
            makeStep(SceneStep.Upper) as unknown as AdvancedUpperStep,
            makeStep(SceneStep.Lower) as unknown as AdvancedLowerStep,
            mockAdvancedLevelsStep,
            makeStep(SceneStep.Investment) as unknown as AdvancedInvestmentStep,
            makeStep(SceneStep.Preview) as unknown as AdvancedPreviewStep,
            mockConfirmStep,
        );
    });

    function createMockContext(overrides: Partial<BotContext> = {}): BotContext {
        return {
            session: { createGrid: {} },
            scene: { leave: vi.fn() },
            reply: vi.fn().mockResolvedValue({}),
            answerCbQuery: vi.fn().mockResolvedValue(undefined),
            ...overrides,
        } as unknown as BotContext;
    }

    describe('createScene', () => {
        it('returns a Scenes.BaseScene instance', () => {
            const scene = handler.createScene();

            expect(scene).toBeInstanceOf(Scenes.BaseScene);
        });
    });

    describe('handlePairAction', () => {
        it('answers callback query and calls selectPairStep.handlePairSelection', async () => {
            const ctx = createMockContext({
                match: [undefined, 'BTC'] as unknown as RegExpExecArray,
            });
            vi.mocked(mockSelectPairStep.handlePairSelection).mockResolvedValue(null);

            await (
                handler as unknown as { handlePairAction(ctx: BotContext): Promise<void> }
            ).handlePairAction(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockSelectPairStep.handlePairSelection).toHaveBeenCalledWith(ctx, 'BTC');
            expect(mockNavigator.completeStep).not.toHaveBeenCalled();
        });

        it('calls navigator.completeStep when result is non-null', async () => {
            const result = { nextStep: SceneStep.Mode, confirmations: ['OK'] };
            const ctx = createMockContext({
                match: [undefined, 'ETH'] as unknown as RegExpExecArray,
            });
            vi.mocked(mockSelectPairStep.handlePairSelection).mockResolvedValue(result);

            await (
                handler as unknown as { handlePairAction(ctx: BotContext): Promise<void> }
            ).handlePairAction(ctx);

            expect(mockNavigator.completeStep).toHaveBeenCalledWith(ctx, result);
        });
    });

    describe('handleOtherPairAction', () => {
        it('answers callback query and calls selectPairStep.handleOtherPair', async () => {
            const ctx = createMockContext();

            await (
                handler as unknown as { handleOtherPairAction(ctx: BotContext): Promise<void> }
            ).handleOtherPairAction(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockSelectPairStep.handleOtherPair).toHaveBeenCalledWith(ctx);
        });
    });

    describe('handleModeAction', () => {
        it('answers callback query and calls selectModeStep.handleModeSelection with Quick', async () => {
            const ctx = createMockContext();
            vi.mocked(mockSelectModeStep.handleModeSelection).mockResolvedValue(null);

            await (
                handler as unknown as {
                    handleModeAction(ctx: BotContext, mode: CreateGridMode): Promise<void>;
                }
            ).handleModeAction(ctx, CreateGridMode.Quick);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockSelectModeStep.handleModeSelection).toHaveBeenCalledWith(
                ctx,
                CreateGridMode.Quick,
            );
        });

        it('calls navigator.completeStep when mode selection returns result', async () => {
            const result = { nextStep: SceneStep.Quick, confirmations: ['Quick mode'] };
            const ctx = createMockContext();
            vi.mocked(mockSelectModeStep.handleModeSelection).mockResolvedValue(result);

            await (
                handler as unknown as {
                    handleModeAction(ctx: BotContext, mode: CreateGridMode): Promise<void>;
                }
            ).handleModeAction(ctx, CreateGridMode.Quick);

            expect(mockNavigator.completeStep).toHaveBeenCalledWith(ctx, result);
        });
    });

    describe('handleLevelsAction', () => {
        it('answers callback query and calls advancedLevelsStep.handleLevelsSelection', async () => {
            const ctx = createMockContext({
                match: [undefined, '10'] as unknown as RegExpExecArray,
            });
            vi.mocked(mockAdvancedLevelsStep.handleLevelsSelection).mockResolvedValue(null);

            await (
                handler as unknown as { handleLevelsAction(ctx: BotContext): Promise<void> }
            ).handleLevelsAction(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockAdvancedLevelsStep.handleLevelsSelection).toHaveBeenCalledWith(ctx, 10);
        });

        it('calls navigator.completeStep when levels result is non-null', async () => {
            const result = { nextStep: SceneStep.Investment, confirmations: ['10 levels'] };
            const ctx = createMockContext({
                match: [undefined, '10'] as unknown as RegExpExecArray,
            });
            vi.mocked(mockAdvancedLevelsStep.handleLevelsSelection).mockResolvedValue(result);

            await (
                handler as unknown as { handleLevelsAction(ctx: BotContext): Promise<void> }
            ).handleLevelsAction(ctx);

            expect(mockNavigator.completeStep).toHaveBeenCalledWith(ctx, result);
        });
    });

    describe('handleBackAction', () => {
        it('answers callback query and calls navigator.handleBack', async () => {
            const ctx = createMockContext();

            await (
                handler as unknown as { handleBackAction(ctx: BotContext): Promise<void> }
            ).handleBackAction(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockNavigator.handleBack).toHaveBeenCalledWith(ctx);
        });
    });

    describe('handleCancelAction', () => {
        it('answers callback query and calls navigator.handleCancel', async () => {
            const ctx = createMockContext();

            await (
                handler as unknown as { handleCancelAction(ctx: BotContext): Promise<void> }
            ).handleCancelAction(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockNavigator.handleCancel).toHaveBeenCalledWith(ctx);
        });
    });

    describe('handleConfirmAction (via private access)', () => {
        it('deletes all messages, executes confirm step, clears session, and leaves scene', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { currentStep: SceneStep.Pair };

            await (
                handler as unknown as { handleConfirmAction(ctx: BotContext): Promise<void> }
            ).handleConfirmAction(ctx);

            expect(mockMessageManager.deleteAllMessages).toHaveBeenCalledWith(ctx);
            expect(mockConfirmStep.execute).toHaveBeenCalledWith(ctx);
            expect(ctx.session.createGrid).toBeUndefined();
            expect(ctx.scene.leave).toHaveBeenCalled();
        });

        it('handles confirm step error gracefully and still cleans up session and leaves', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};
            vi.mocked(mockConfirmStep.execute).mockRejectedValue(new Error('Grid creation failed'));

            await (
                handler as unknown as { handleConfirmAction(ctx: BotContext): Promise<void> }
            ).handleConfirmAction(ctx);

            expect(ctx.reply).toHaveBeenCalledWith('❌ Failed to create grid. Please try again.');
            expect(ctx.session.createGrid).toBeUndefined();
            expect(ctx.scene.leave).toHaveBeenCalled();
        });
    });

    describe('handleTextInput (via private access)', () => {
        it('leaves scene when message starts with /', async () => {
            const ctx = {
                ...createMockContext(),
                message: { text: '/start' },
            } as unknown as BotContext;

            await (
                handler as unknown as { handleTextInput(ctx: BotContext): Promise<void> }
            ).handleTextInput(ctx);

            expect(ctx.scene.leave).toHaveBeenCalled();
        });

        it('does nothing when message is not a text message', async () => {
            const ctx = {
                ...createMockContext(),
                message: { photo: [] },
            } as unknown as BotContext;

            await (
                handler as unknown as { handleTextInput(ctx: BotContext): Promise<void> }
            ).handleTextInput(ctx);

            expect(ctx.scene.leave).not.toHaveBeenCalled();
        });

        it('delegates text input to current step handler', async () => {
            const mockStep = {
                handleTextInput: vi.fn().mockResolvedValue({
                    nextStep: SceneStep.Mode,
                    confirmations: [],
                }),
            };
            vi.mocked(mockNavigator.getCurrentStep).mockReturnValue(SceneStep.Pair);
            vi.mocked(mockNavigator.getStepInstance).mockReturnValue(
                mockStep as unknown as WizardStep,
            );

            const ctx = {
                ...createMockContext(),
                message: { text: 'BTC' },
            } as unknown as BotContext;

            await (
                handler as unknown as { handleTextInput(ctx: BotContext): Promise<void> }
            ).handleTextInput(ctx);

            expect(mockStep.handleTextInput).toHaveBeenCalledWith(ctx, 'BTC');
            expect(mockNavigator.completeStep).toHaveBeenCalled();
        });

        it('leaves scene when text is a reply menu label', async () => {
            const ctx = {
                ...createMockContext(),
                message: { text: '📊 Grids' },
            } as unknown as BotContext;

            await (
                handler as unknown as { handleTextInput(ctx: BotContext): Promise<void> }
            ).handleTextInput(ctx);

            expect(ctx.scene.leave).toHaveBeenCalled();
        });

        it('returns without delegating when getCurrentStep is null', async () => {
            vi.mocked(mockNavigator.getCurrentStep).mockReturnValue(null);

            const ctx = {
                ...createMockContext(),
                message: { text: 'BTC' },
            } as unknown as BotContext;

            await (
                handler as unknown as { handleTextInput(ctx: BotContext): Promise<void> }
            ).handleTextInput(ctx);

            expect(mockNavigator.getStepInstance).not.toHaveBeenCalled();
            expect(mockNavigator.completeStep).not.toHaveBeenCalled();
        });

        it('returns without delegating when step has no handleTextInput', async () => {
            const mockStep = { enter: vi.fn(), rollbackState: vi.fn() };
            vi.mocked(mockNavigator.getCurrentStep).mockReturnValue(SceneStep.Pair);
            vi.mocked(mockNavigator.getStepInstance).mockReturnValue(
                mockStep as unknown as WizardStep,
            );

            const ctx = {
                ...createMockContext(),
                message: { text: 'BTC' },
            } as unknown as BotContext;

            await (
                handler as unknown as { handleTextInput(ctx: BotContext): Promise<void> }
            ).handleTextInput(ctx);

            expect(mockNavigator.completeStep).not.toHaveBeenCalled();
        });

        it('does not call completeStep when handleTextInput returns null', async () => {
            const mockStep = {
                handleTextInput: vi.fn().mockResolvedValue(null),
            };
            vi.mocked(mockNavigator.getCurrentStep).mockReturnValue(SceneStep.Pair);
            vi.mocked(mockNavigator.getStepInstance).mockReturnValue(
                mockStep as unknown as WizardStep,
            );

            const ctx = {
                ...createMockContext(),
                message: { text: 'invalid' },
            } as unknown as BotContext;

            await (
                handler as unknown as { handleTextInput(ctx: BotContext): Promise<void> }
            ).handleTextInput(ctx);

            expect(mockStep.handleTextInput).toHaveBeenCalledWith(ctx, 'invalid');
            expect(mockNavigator.completeStep).not.toHaveBeenCalled();
        });

        it('returns early when message is undefined', async () => {
            const ctx = {
                ...createMockContext(),
                message: undefined,
            } as unknown as BotContext;

            await (
                handler as unknown as { handleTextInput(ctx: BotContext): Promise<void> }
            ).handleTextInput(ctx);

            expect(ctx.scene.leave).not.toHaveBeenCalled();
            expect(mockNavigator.getCurrentStep).not.toHaveBeenCalled();
        });
    });
});

// Type alias to avoid import cycle
type WizardStep = import('./wizard/wizard-step').WizardStep;
