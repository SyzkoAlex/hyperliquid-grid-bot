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
import { AdvancedPreviewStep } from './steps/advanced-preview.step';
import { ConfirmStep } from './steps/confirm.step';
import { BotContext } from '../../types/bot-context';
import { CREATE_GRID_ACTIONS, CREATE_GRID_PATTERNS } from './create-grid-actions';
import { WizardNavigator } from './wizard/wizard-navigator';
import { WizardMessageManager } from './wizard/wizard-message-manager';

export const CREATE_GRID_SCENE_ID = 'create_grid';

@Injectable()
export class CreateGridSceneHandler {
    readonly id = CREATE_GRID_SCENE_ID;

    constructor(
        private readonly navigator: WizardNavigator,
        private readonly messageManager: WizardMessageManager,
        private readonly selectPairStep: SelectPairStep,
        private readonly selectModeStep: SelectModeStep,
        private readonly quickStartStep: QuickStartStep,
        private readonly advancedUpperStep: AdvancedUpperStep,
        private readonly advancedLowerStep: AdvancedLowerStep,
        private readonly advancedLevelsStep: AdvancedLevelsStep,
        private readonly advancedInvestmentStep: AdvancedInvestmentStep,
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

        scene.action(CREATE_GRID_ACTIONS.CONFIRM, (ctx) => this.handleConfirmAction(ctx));
        scene.action(CREATE_GRID_ACTIONS.BACK, (ctx) => this.handleBackAction(ctx));
        scene.action(CREATE_GRID_ACTIONS.CANCEL, (ctx) => this.handleCancelAction(ctx));

        scene.on('text', (ctx) => this.handleTextInput(ctx));

        return scene;
    }

    private async handlePairAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        if (!('match' in ctx) || !ctx.match) {
            return;
        }
        const match = ctx.match as RegExpMatchArray;
        const symbol = match[1] || '';

        const result = await this.selectPairStep.handlePairSelection(ctx, symbol);
        if (result) {
            await this.navigator.completeStep(ctx, result);
        }
    }

    private async handleOtherPairAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await this.selectPairStep.handleOtherPair(ctx);
    }

    private async handleModeAction(ctx: BotContext, mode: CreateGridMode): Promise<void> {
        await ctx.answerCbQuery();
        const result = await this.selectModeStep.handleModeSelection(ctx, mode);
        if (result) {
            await this.navigator.completeStep(ctx, result);
        }
    }

    private async handleLevelsAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        if (!('match' in ctx) || !ctx.match) {
            return;
        }
        const match = ctx.match as RegExpMatchArray;
        const levels = parseInt(match[1] || '0', 10);

        const result = await this.advancedLevelsStep.handleLevelsSelection(ctx, levels);
        if (result) {
            await this.navigator.completeStep(ctx, result);
        }
    }

    private async handleConfirmAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();

        await this.messageManager.deleteAllMessages(ctx);
        await this.confirmStep.execute(ctx);

        delete ctx.session.createGrid;
        await ctx.scene.leave();
    }

    private async handleBackAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await this.navigator.handleBack(ctx);
    }

    private async handleCancelAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await this.navigator.handleCancel(ctx);
    }

    private async handleTextInput(ctx: BotContext): Promise<void> {
        if (!ctx.message || !('text' in ctx.message)) {
            return;
        }

        const text = ctx.message.text;

        if (text.startsWith('/')) {
            await ctx.scene.leave();
            return;
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
        }
    }
}
