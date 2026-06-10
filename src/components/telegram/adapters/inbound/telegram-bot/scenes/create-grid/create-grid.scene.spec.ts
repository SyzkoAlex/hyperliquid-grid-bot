import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scenes } from 'telegraf';
import { CreateGridSceneHandler } from './create-grid.scene';
import { WizardNavigator } from './wizard/wizard-navigator';
import { WizardStep } from './wizard/wizard-step';
import { SelectPairStep } from './steps/select-pair.step';
import { SelectModeStep } from './steps/select-mode.step';
import { QuickStartStep } from './steps/quick-start.step';
import { AdvancedUpperStep } from './steps/advanced-upper.step';
import { AdvancedLowerStep } from './steps/advanced-lower.step';
import { AdvancedLevelsStep } from './steps/advanced-levels.step';
import { AdvancedInvestmentStep } from './steps/advanced-investment.step';
import { SwapStep } from './steps/swap.step';
import { AdvancedStopLossStep } from './steps/advanced-stop-loss.step';
import { AdvancedPreviewStep } from './steps/advanced-preview.step';
import { ConfirmStep } from './steps/confirm.step';
import { BotContext } from '../../types/bot-context';
import { SceneStep } from './create-grid-scene-step';
import { CreateGridMode } from './create-grid-mode';

describe('CreateGridSceneHandler', () => {
    let handler: CreateGridSceneHandler;
    let mockNavigator: WizardNavigator;
    let mockConfirmStep: ConfirmStep;
    let mockSelectPairStep: SelectPairStep;
    let mockSelectModeStep: SelectModeStep;
    let mockAdvancedLevelsStep: AdvancedLevelsStep;
    let mockAdvancedUpperStep: AdvancedUpperStep;
    let mockAdvancedLowerStep: AdvancedLowerStep;
    let mockAdvancedStopLossStep: AdvancedStopLossStep;
    let mockQuickStartStep: QuickStartStep;
    let mockAdvancedInvestmentStep: AdvancedInvestmentStep;
    let mockSwapStep: SwapStep;

    beforeEach(() => {
        mockNavigator = {
            start: vi.fn().mockResolvedValue(undefined),
            completeStep: vi.fn().mockResolvedValue(undefined),
            handleBack: vi.fn().mockResolvedValue(undefined),
            handleCancel: vi.fn().mockResolvedValue(undefined),
            getCurrentStep: vi.fn().mockReturnValue(null),
            getStepInstance: vi.fn().mockReturnValue(undefined),
            registerStep: vi.fn(),
            renderCurrentStep: vi.fn().mockResolvedValue(undefined),
        } as unknown as WizardNavigator;

        mockConfirmStep = {
            execute: vi.fn().mockResolvedValue(undefined),
        } as unknown as ConfirmStep;

        mockSelectPairStep = {
            id: SceneStep.Pair,
            buildView: vi.fn().mockResolvedValue({ body: '', keyboard: [] }),
            rollbackState: vi.fn(),
            handlePairSelection: vi.fn().mockResolvedValue(null),
            handleOtherPair: vi.fn().mockResolvedValue(undefined),
            handleTextInput: vi.fn().mockResolvedValue(null),
        } as unknown as SelectPairStep;

        mockSelectModeStep = {
            id: SceneStep.Mode,
            buildView: vi.fn().mockResolvedValue({ body: '', keyboard: [] }),
            rollbackState: vi.fn(),
            handleModeSelection: vi.fn().mockResolvedValue(null),
        } as unknown as SelectModeStep;

        mockAdvancedLevelsStep = {
            id: SceneStep.Levels,
            buildView: vi.fn().mockResolvedValue({ body: '', keyboard: [] }),
            rollbackState: vi.fn(),
            handleLevelsSelection: vi.fn().mockResolvedValue(null),
        } as unknown as AdvancedLevelsStep;

        mockAdvancedUpperStep = {
            id: SceneStep.Upper,
            buildView: vi.fn().mockResolvedValue({ body: '', keyboard: [] }),
            rollbackState: vi.fn(),
            handleUpperPreset: vi.fn().mockResolvedValue(null),
            handleTextInput: vi.fn().mockResolvedValue(null),
        } as unknown as AdvancedUpperStep;

        mockAdvancedLowerStep = {
            id: SceneStep.Lower,
            buildView: vi.fn().mockResolvedValue({ body: '', keyboard: [] }),
            rollbackState: vi.fn(),
            handleLowerPreset: vi.fn().mockResolvedValue(null),
            handleTextInput: vi.fn().mockResolvedValue(null),
        } as unknown as AdvancedLowerStep;

        mockAdvancedStopLossStep = {
            id: SceneStep.StopLoss,
            buildView: vi.fn().mockResolvedValue({ body: '', keyboard: [] }),
            rollbackState: vi.fn(),
            handleStopLossPreset: vi.fn().mockResolvedValue(null),
            handleSkip: vi.fn().mockResolvedValue(null),
            handleTextInput: vi.fn().mockResolvedValue(null),
        } as unknown as AdvancedStopLossStep;

        mockQuickStartStep = {
            id: SceneStep.Quick,
            buildView: vi.fn().mockResolvedValue({ body: '', keyboard: [] }),
            rollbackState: vi.fn(),
            handleInvestmentPreset: vi.fn().mockResolvedValue(null),
            handleTextInput: vi.fn().mockResolvedValue(null),
        } as unknown as QuickStartStep;

        mockAdvancedInvestmentStep = {
            id: SceneStep.Investment,
            buildView: vi.fn().mockResolvedValue({ body: '', keyboard: [] }),
            rollbackState: vi.fn(),
            handleInvestmentPreset: vi.fn().mockResolvedValue(null),
            handleTextInput: vi.fn().mockResolvedValue(null),
        } as unknown as AdvancedInvestmentStep;

        mockSwapStep = {
            id: SceneStep.Swap,
            buildView: vi.fn().mockResolvedValue({ body: '', keyboard: [] }),
            rollbackState: vi.fn(),
            handleConfirm: vi.fn().mockResolvedValue(null),
            handleSkip: vi.fn().mockResolvedValue(null),
        } as unknown as SwapStep;

        const makeStep = (id: SceneStep) =>
            ({
                id,
                buildView: vi.fn().mockResolvedValue({ body: '', keyboard: [] }),
                rollbackState: vi.fn(),
                handleTextInput: vi.fn().mockResolvedValue(null),
            }) as unknown as WizardStep;

        handler = new CreateGridSceneHandler(
            mockNavigator,
            mockSelectPairStep,
            mockSelectModeStep,
            mockQuickStartStep,
            mockAdvancedUpperStep,
            mockAdvancedLowerStep,
            mockAdvancedLevelsStep,
            mockAdvancedInvestmentStep,
            mockSwapStep,
            mockAdvancedStopLossStep,
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
            deleteMessage: vi.fn().mockResolvedValue(undefined),
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
            const result = { nextStep: SceneStep.Mode };
            const ctx = createMockContext({
                match: [undefined, 'ETH'] as unknown as RegExpExecArray,
            });
            vi.mocked(mockSelectPairStep.handlePairSelection).mockResolvedValue(result);

            await (
                handler as unknown as { handlePairAction(ctx: BotContext): Promise<void> }
            ).handlePairAction(ctx);

            expect(mockNavigator.completeStep).toHaveBeenCalledWith(ctx, result);
        });

        it('calls navigator.renderCurrentStep when result is null but pendingError is set', async () => {
            const ctx = createMockContext({
                match: [undefined, 'INVALID'] as unknown as RegExpExecArray,
            });
            ctx.session.createGrid = { pendingError: '❌ Not found' };
            vi.mocked(mockSelectPairStep.handlePairSelection).mockResolvedValue(null);

            await (
                handler as unknown as { handlePairAction(ctx: BotContext): Promise<void> }
            ).handlePairAction(ctx);

            expect(mockNavigator.renderCurrentStep).toHaveBeenCalledWith(ctx);
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

        it('calls renderCurrentStep when pendingError is set after handleOtherPair', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { pendingError: 'Enter token symbol' };

            await (
                handler as unknown as { handleOtherPairAction(ctx: BotContext): Promise<void> }
            ).handleOtherPairAction(ctx);

            expect(mockNavigator.renderCurrentStep).toHaveBeenCalledWith(ctx);
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
            const result = { nextStep: SceneStep.Quick };
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
            const result = { nextStep: SceneStep.Investment };
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

    describe('handleUpperPresetAction', () => {
        it('calls advancedUpperStep.handleUpperPreset with the matched raw value', async () => {
            const ctx = createMockContext({
                match: [undefined, '10'] as unknown as RegExpExecArray,
            });
            vi.mocked(mockAdvancedUpperStep.handleUpperPreset).mockResolvedValue(null);

            await (
                handler as unknown as { handleUpperPresetAction(ctx: BotContext): Promise<void> }
            ).handleUpperPresetAction(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockAdvancedUpperStep.handleUpperPreset).toHaveBeenCalledWith(ctx, '10');
        });

        it('calls completeStep when preset handler returns a result', async () => {
            const result = { nextStep: SceneStep.Lower };
            const ctx = createMockContext({
                match: [undefined, '10'] as unknown as RegExpExecArray,
            });
            vi.mocked(mockAdvancedUpperStep.handleUpperPreset).mockResolvedValue(result);

            await (
                handler as unknown as { handleUpperPresetAction(ctx: BotContext): Promise<void> }
            ).handleUpperPresetAction(ctx);

            expect(mockNavigator.completeStep).toHaveBeenCalledWith(ctx, result);
        });
    });

    describe('handleLowerPresetAction', () => {
        it('calls advancedLowerStep.handleLowerPreset with the matched raw value', async () => {
            const ctx = createMockContext({
                match: [undefined, '10'] as unknown as RegExpExecArray,
            });
            vi.mocked(mockAdvancedLowerStep.handleLowerPreset).mockResolvedValue(null);

            await (
                handler as unknown as { handleLowerPresetAction(ctx: BotContext): Promise<void> }
            ).handleLowerPresetAction(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockAdvancedLowerStep.handleLowerPreset).toHaveBeenCalledWith(ctx, '10');
        });
    });

    describe('handleQuickInvestmentPresetAction', () => {
        it('calls quickStartStep.handleInvestmentPreset with the matched key and completes step', async () => {
            const result = { nextStep: SceneStep.Preview };
            const ctx = createMockContext({
                match: [undefined, '50'] as unknown as RegExpExecArray,
            });
            vi.mocked(mockQuickStartStep.handleInvestmentPreset).mockResolvedValue(result);

            await (
                handler as unknown as {
                    handleQuickInvestmentPresetAction(ctx: BotContext): Promise<void>;
                }
            ).handleQuickInvestmentPresetAction(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockQuickStartStep.handleInvestmentPreset).toHaveBeenCalledWith(ctx, '50');
            expect(mockNavigator.completeStep).toHaveBeenCalledWith(ctx, result);
        });
    });

    describe('handleAdvInvestmentPresetAction', () => {
        it('calls advancedInvestmentStep.handleInvestmentPreset with the matched key and completes step', async () => {
            const result = { nextStep: SceneStep.StopLoss };
            const ctx = createMockContext({
                match: [undefined, '75'] as unknown as RegExpExecArray,
            });
            vi.mocked(mockAdvancedInvestmentStep.handleInvestmentPreset).mockResolvedValue(result);

            await (
                handler as unknown as {
                    handleAdvInvestmentPresetAction(ctx: BotContext): Promise<void>;
                }
            ).handleAdvInvestmentPresetAction(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockAdvancedInvestmentStep.handleInvestmentPreset).toHaveBeenCalledWith(
                ctx,
                '75',
            );
            expect(mockNavigator.completeStep).toHaveBeenCalledWith(ctx, result);
        });
    });

    describe('handleStopLossOffAction', () => {
        it('calls advancedStopLossStep.handleSkip and completes step', async () => {
            const result = { nextStep: SceneStep.Preview };
            const ctx = createMockContext();
            vi.mocked(mockAdvancedStopLossStep.handleSkip).mockResolvedValue(result);

            await (
                handler as unknown as {
                    handleStopLossOffAction(ctx: BotContext): Promise<void>;
                }
            ).handleStopLossOffAction(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockAdvancedStopLossStep.handleSkip).toHaveBeenCalledWith(ctx);
            expect(mockNavigator.completeStep).toHaveBeenCalledWith(ctx, result);
        });
    });

    describe('handleStopLossPresetAction', () => {
        it('calls advancedStopLossStep.handleStopLossPreset with the matched key', async () => {
            const ctx = createMockContext({
                match: [undefined, '10'] as unknown as RegExpExecArray,
            });
            vi.mocked(mockAdvancedStopLossStep.handleStopLossPreset).mockResolvedValue(null);

            await (
                handler as unknown as {
                    handleStopLossPresetAction(ctx: BotContext): Promise<void>;
                }
            ).handleStopLossPresetAction(ctx);

            expect(ctx.answerCbQuery).toHaveBeenCalled();
            expect(mockAdvancedStopLossStep.handleStopLossPreset).toHaveBeenCalledWith(ctx, '10');
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
        it('executes confirm step, clears session, and leaves scene', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { currentStep: SceneStep.Pair };

            await (
                handler as unknown as { handleConfirmAction(ctx: BotContext): Promise<void> }
            ).handleConfirmAction(ctx);

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

        it('attempts to delete user text message before delegating', async () => {
            const mockStep = {
                handleTextInput: vi.fn().mockResolvedValue(null),
            };
            vi.mocked(mockNavigator.getCurrentStep).mockReturnValue(SceneStep.Pair);
            vi.mocked(mockNavigator.getStepInstance).mockReturnValue(
                mockStep as unknown as WizardStep,
            );

            const ctx = {
                ...createMockContext(),
                message: { text: 'BTC', message_id: 99 },
                deleteMessage: vi.fn().mockResolvedValue(undefined),
            } as unknown as BotContext;

            await (
                handler as unknown as { handleTextInput(ctx: BotContext): Promise<void> }
            ).handleTextInput(ctx);

            expect(ctx.deleteMessage).toHaveBeenCalledWith(99);
        });

        it('handles deleteMessage failure gracefully', async () => {
            const mockStep = {
                handleTextInput: vi.fn().mockResolvedValue(null),
            };
            vi.mocked(mockNavigator.getCurrentStep).mockReturnValue(SceneStep.Pair);
            vi.mocked(mockNavigator.getStepInstance).mockReturnValue(
                mockStep as unknown as WizardStep,
            );

            const ctx = {
                ...createMockContext(),
                message: { text: 'BTC', message_id: 99 },
                deleteMessage: vi.fn().mockRejectedValue(new Error('not found')),
            } as unknown as BotContext;

            await expect(
                (
                    handler as unknown as { handleTextInput(ctx: BotContext): Promise<void> }
                ).handleTextInput(ctx),
            ).resolves.not.toThrow();
        });

        it('delegates text input to current step handler', async () => {
            const mockStep = {
                handleTextInput: vi.fn().mockResolvedValue({
                    nextStep: SceneStep.Mode,
                }),
            };
            vi.mocked(mockNavigator.getCurrentStep).mockReturnValue(SceneStep.Pair);
            vi.mocked(mockNavigator.getStepInstance).mockReturnValue(
                mockStep as unknown as WizardStep,
            );

            const ctx = {
                ...createMockContext(),
                message: { text: 'BTC', message_id: 10 },
            } as unknown as BotContext;

            await (
                handler as unknown as { handleTextInput(ctx: BotContext): Promise<void> }
            ).handleTextInput(ctx);

            expect(mockStep.handleTextInput).toHaveBeenCalledWith(ctx, 'BTC');
            expect(mockNavigator.completeStep).toHaveBeenCalled();
        });

        it('calls renderCurrentStep when step returns null and pendingError is set', async () => {
            const mockStep = {
                handleTextInput: vi.fn().mockResolvedValue(null),
            };
            vi.mocked(mockNavigator.getCurrentStep).mockReturnValue(SceneStep.Pair);
            vi.mocked(mockNavigator.getStepInstance).mockReturnValue(
                mockStep as unknown as WizardStep,
            );

            const ctx = {
                ...createMockContext(),
                message: { text: 'invalid', message_id: 10 },
            } as unknown as BotContext;
            ctx.session.createGrid = { pendingError: '❌ Error' };

            await (
                handler as unknown as { handleTextInput(ctx: BotContext): Promise<void> }
            ).handleTextInput(ctx);

            expect(mockNavigator.renderCurrentStep).toHaveBeenCalledWith(ctx);
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
            const mockStep = { buildView: vi.fn(), rollbackState: vi.fn() };
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
