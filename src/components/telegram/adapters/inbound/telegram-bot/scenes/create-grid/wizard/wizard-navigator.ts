import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { WizardStep } from './wizard-step';
import { StepCompleted } from './step-result';
import { WizardMessageManager } from './wizard-message-manager';
import { CommonTexts } from '@components/telegram/core/domain/models/messages/common.texts';

@Injectable()
export class WizardNavigator {
    private steps: Map<SceneStep, WizardStep> = new Map();

    constructor(private readonly messageManager: WizardMessageManager) {}

    registerStep(step: WizardStep): void {
        this.steps.set(step.id, step);
    }

    async start(ctx: BotContext): Promise<void> {
        ctx.session.createGrid = {
            currentStep: SceneStep.Pair,
            stepHistory: [],
            stepMessages: {},
        };

        this.messageManager.initStep(ctx, SceneStep.Pair);
        const firstStep = this.steps.get(SceneStep.Pair);
        if (firstStep) {
            await firstStep.enter(ctx);
        }
    }

    async completeStep(ctx: BotContext, result: StepCompleted): Promise<void> {
        const state = ctx.session.createGrid;
        if (!state?.currentStep) {
            return;
        }

        const currentStepId = state.currentStep;

        await this.messageManager.deleteEnterMessages(ctx, currentStepId);

        if (result.confirmations) {
            for (const text of result.confirmations) {
                await this.messageManager.sendConfirmation(ctx, currentStepId, text);
            }
        }

        if (!state.stepHistory) {
            state.stepHistory = [];
        }
        state.stepHistory.push(currentStepId);

        state.currentStep = result.nextStep;
        this.messageManager.initStep(ctx, result.nextStep);

        const nextStep = this.steps.get(result.nextStep);
        if (nextStep) {
            await nextStep.enter(ctx);
        }
    }

    async handleBack(ctx: BotContext): Promise<void> {
        const state = ctx.session.createGrid;
        if (!state?.currentStep || !state.stepHistory) {
            return;
        }

        const currentStepId = state.currentStep;

        await this.messageManager.deleteEnterMessages(ctx, currentStepId);

        if (state.showingValidationError) {
            state.showingValidationError = false;
            this.messageManager.initStep(ctx, currentStepId);

            const currentStep = this.steps.get(currentStepId);
            if (currentStep) {
                await currentStep.enter(ctx);
            }
            return;
        }

        const previousStepId = state.stepHistory.pop();
        if (!previousStepId) {
            return;
        }

        await this.messageManager.deleteConfirmationMessages(ctx, previousStepId);

        const previousStep = this.steps.get(previousStepId);
        if (previousStep) {
            previousStep.rollbackState(ctx);
        }

        if (state.stepMessages?.[currentStepId]) {
            delete state.stepMessages[currentStepId];
        }

        state.currentStep = previousStepId;
        this.messageManager.initStep(ctx, previousStepId);

        if (previousStep) {
            await previousStep.enter(ctx);
        }
    }

    async handleCancel(ctx: BotContext): Promise<void> {
        const hasStarted = (ctx.session.createGrid?.stepHistory?.length ?? 0) > 0;

        await this.messageManager.deleteAllMessages(ctx);

        delete ctx.session.createGrid;
        await ctx.scene.leave();

        if (hasStarted) {
            await ctx.reply(CommonTexts.GRID_CREATION_CANCELLED);
        }
    }

    getCurrentStep(ctx: BotContext): SceneStep | null {
        return ctx.session.createGrid?.currentStep ?? null;
    }

    getStepInstance(stepId: SceneStep): WizardStep | undefined {
        return this.steps.get(stepId);
    }
}
