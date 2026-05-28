import { Injectable } from '@nestjs/common';
import { Scenes } from 'telegraf';
import { CreateGridMode } from './create-grid-mode';
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
import { CREATE_GRID_ACTIONS, CREATE_GRID_PATTERNS } from './create-grid-actions';
import { SceneStep } from './create-grid-scene-step';
import { WizardNavigator } from './wizard/wizard-navigator';
import { StepResult } from './wizard/step-result';
import { isReplyMenuText } from '../../handlers/main-menu.keyboard';
import { SceneHandler } from '../scene-handler';
import { CommonTexts } from '@components/telegram/core/domain/models/messages/common.texts';
import { logger } from '@/infra/logger/logger';

export const CREATE_GRID_SCENE_ID = 'create_grid';

@Injectable()
export class CreateGridSceneHandler implements SceneHandler {
    readonly id = CREATE_GRID_SCENE_ID;
    private readonly logger = logger.child({ context: CreateGridSceneHandler.name });

    constructor(
        private readonly navigator: WizardNavigator,
        private readonly selectPairStep: SelectPairStep,
        private readonly selectModeStep: SelectModeStep,
        private readonly quickStartStep: QuickStartStep,
        private readonly advancedUpperStep: AdvancedUpperStep,
        private readonly advancedLowerStep: AdvancedLowerStep,
        private readonly advancedLevelsStep: AdvancedLevelsStep,
        private readonly advancedInvestmentStep: AdvancedInvestmentStep,
        private readonly swapStep: SwapStep,
        private readonly advancedStopLossStep: AdvancedStopLossStep,
        private readonly advancedPreviewStep: AdvancedPreviewStep,
        private readonly confirmStep: ConfirmStep,
    ) {
        this.navigator.registerStep(selectPairStep);
        this.navigator.registerStep(selectModeStep);
        this.navigator.registerStep(quickStartStep);
        this.navigator.registerStep(advancedUpperStep);
        this.navigator.registerStep(advancedLowerStep);
        this.navigator.registerStep(advancedLevelsStep);
        this.navigator.registerStep(advancedInvestmentStep);
        this.navigator.registerStep(swapStep);
        this.navigator.registerStep(advancedStopLossStep);
        this.navigator.registerStep(advancedPreviewStep);
    }

    createScene(): Scenes.BaseScene<BotContext> {
        const scene = new Scenes.BaseScene<BotContext>(CREATE_GRID_SCENE_ID);

        scene.enter((ctx) => this.navigator.start(ctx));

        scene.action(CREATE_GRID_PATTERNS.PAIR, (ctx) => this.handlePairAction(ctx));
        scene.action(CREATE_GRID_ACTIONS.OTHER_PAIR, (ctx) => this.handleOtherPairAction(ctx));

        scene.action(CREATE_GRID_ACTIONS.MODE_QUICK, (ctx) =>
            this.handleModeAction(ctx, CreateGridMode.Quick),
        );
        scene.action(CREATE_GRID_ACTIONS.MODE_ADVANCED, (ctx) =>
            this.handleModeAction(ctx, CreateGridMode.Advanced),
        );

        scene.action(CREATE_GRID_PATTERNS.LEVELS, (ctx) => this.handleLevelsAction(ctx));

        scene.action(CREATE_GRID_PATTERNS.UPPER_PRESET, (ctx) => this.handleUpperPresetAction(ctx));
        scene.action(CREATE_GRID_PATTERNS.LOWER_PRESET, (ctx) => this.handleLowerPresetAction(ctx));
        scene.action(CREATE_GRID_PATTERNS.QUICK_INVESTMENT_PRESET, (ctx) =>
            this.handleQuickInvestmentPresetAction(ctx),
        );
        scene.action(CREATE_GRID_PATTERNS.ADV_INVESTMENT_PRESET, (ctx) =>
            this.handleAdvInvestmentPresetAction(ctx),
        );
        scene.action(CREATE_GRID_PATTERNS.STOP_LOSS_PRESET, (ctx) =>
            this.handleStopLossPresetAction(ctx),
        );

        scene.action(CREATE_GRID_ACTIONS.STOP_LOSS_OFF, (ctx) => this.handleStopLossOffAction(ctx));

        scene.action(CREATE_GRID_ACTIONS.SWAP_OFFER, (ctx) => this.handleSwapOfferAction(ctx));
        scene.action(CREATE_GRID_ACTIONS.SWAP_CONFIRM, (ctx) => this.handleSwapConfirmAction(ctx));
        scene.action(CREATE_GRID_ACTIONS.SWAP_SKIP, (ctx) => this.handleSwapSkipAction(ctx));

        scene.action(CREATE_GRID_ACTIONS.CONFIRM, (ctx) => this.handleConfirmAction(ctx));
        scene.action(CREATE_GRID_ACTIONS.BACK, (ctx) => this.handleBackAction(ctx));
        scene.action(CREATE_GRID_ACTIONS.CANCEL, (ctx) => this.handleCancelAction(ctx));

        scene.on('text', (ctx) => this.handleTextInput(ctx));

        return scene;
    }

    private async runStepAction(
        ctx: BotContext,
        handlerFn: () => Promise<StepResult>,
    ): Promise<void> {
        try {
            const result = await handlerFn();
            if (result) {
                await this.navigator.completeStep(ctx, result);
            } else if (ctx.session.createGrid?.pendingError) {
                await this.navigator.renderCurrentStep(ctx);
            }
        } finally {
            await ctx.answerCbQuery();
        }
    }

    private async handlePairAction(ctx: BotContext): Promise<void> {
        const symbol = ctx.match![1];
        return this.runStepAction(ctx, () => this.selectPairStep.handlePairSelection(ctx, symbol));
    }

    private async handleOtherPairAction(ctx: BotContext): Promise<void> {
        try {
            await this.selectPairStep.handleOtherPair(ctx);
            if (ctx.session.createGrid?.pendingError) {
                await this.navigator.renderCurrentStep(ctx);
            }
        } finally {
            await ctx.answerCbQuery();
        }
    }

    private async handleModeAction(ctx: BotContext, mode: CreateGridMode): Promise<void> {
        return this.runStepAction(ctx, () => this.selectModeStep.handleModeSelection(ctx, mode));
    }

    private async handleLevelsAction(ctx: BotContext): Promise<void> {
        const levels = parseInt(ctx.match![1], 10);
        return this.runStepAction(ctx, () =>
            this.advancedLevelsStep.handleLevelsSelection(ctx, levels),
        );
    }

    private async handleUpperPresetAction(ctx: BotContext): Promise<void> {
        const raw = ctx.match![1];
        return this.runStepAction(ctx, () => this.advancedUpperStep.handleUpperPreset(ctx, raw));
    }

    private async handleLowerPresetAction(ctx: BotContext): Promise<void> {
        const raw = ctx.match![1];
        return this.runStepAction(ctx, () => this.advancedLowerStep.handleLowerPreset(ctx, raw));
    }

    private async handleQuickInvestmentPresetAction(ctx: BotContext): Promise<void> {
        const key = ctx.match![1];
        return this.runStepAction(ctx, () => this.quickStartStep.handleInvestmentPreset(ctx, key));
    }

    private async handleAdvInvestmentPresetAction(ctx: BotContext): Promise<void> {
        const key = ctx.match![1];
        return this.runStepAction(ctx, () =>
            this.advancedInvestmentStep.handleInvestmentPreset(ctx, key),
        );
    }

    private async handleStopLossPresetAction(ctx: BotContext): Promise<void> {
        const key = ctx.match![1];
        return this.runStepAction(ctx, () =>
            this.advancedStopLossStep.handleStopLossPreset(ctx, key),
        );
    }

    private async handleStopLossOffAction(ctx: BotContext): Promise<void> {
        return this.runStepAction(ctx, () => this.advancedStopLossStep.handleSkip(ctx));
    }

    private async handleSwapOfferAction(ctx: BotContext): Promise<void> {
        return this.runStepAction(ctx, async () => ({ nextStep: SceneStep.Swap }));
    }

    private async handleSwapConfirmAction(ctx: BotContext): Promise<void> {
        return this.runStepAction(ctx, () => this.swapStep.handleConfirm(ctx));
    }

    private async handleSwapSkipAction(ctx: BotContext): Promise<void> {
        return this.runStepAction(ctx, () => this.swapStep.handleSkip(ctx));
    }

    private async handleConfirmAction(ctx: BotContext): Promise<void> {
        try {
            try {
                await this.confirmStep.execute(ctx);
            } catch (error) {
                this.logger.error({ error }, 'Failed to execute confirm step');
                await ctx.reply(CommonTexts.CREATE_GRID_ERROR);
            }
            delete ctx.session.createGrid;
            await ctx.scene.leave();
        } finally {
            await ctx.answerCbQuery();
        }
    }

    private async handleBackAction(ctx: BotContext): Promise<void> {
        try {
            await this.navigator.handleBack(ctx);
        } finally {
            await ctx.answerCbQuery();
        }
    }

    private async handleCancelAction(ctx: BotContext): Promise<void> {
        try {
            await this.navigator.handleCancel(ctx);
        } finally {
            await ctx.answerCbQuery();
        }
    }

    private async handleTextInput(ctx: BotContext): Promise<void> {
        if (!ctx.message || !('text' in ctx.message)) {
            return;
        }

        const text = ctx.message.text;

        if (text.startsWith('/') || isReplyMenuText(text)) {
            await ctx.scene.leave();
            return;
        }

        if ('message_id' in ctx.message) {
            try {
                await ctx.deleteMessage(ctx.message.message_id);
            } catch (error) {
                this.logger.warn({ error }, 'Failed to delete user text message');
            }
        }

        const currentStepId = this.navigator.getCurrentStep(ctx);
        if (!currentStepId) {
            return;
        }

        const currentStep = this.navigator.getStepInstance(currentStepId);
        if (!currentStep?.handleTextInput) {
            return;
        }

        const result = await currentStep.handleTextInput(ctx, text);
        if (result) {
            await this.navigator.completeStep(ctx, result);
        } else if (ctx.session.createGrid?.pendingError) {
            await this.navigator.renderCurrentStep(ctx);
        }
    }
}
