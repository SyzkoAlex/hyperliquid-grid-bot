import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { WizardStep } from './wizard-step';
import { StepCompleted } from './step-result';
import { BoardRenderer } from './board-renderer';
import { CommonTexts } from '@components/telegram/core/domain/models/messages/common.texts';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class WizardNavigator {
    private readonly logger = logger.child({ context: WizardNavigator.name });
    private steps: Map<SceneStep, WizardStep> = new Map();

    constructor(private readonly boardRenderer: BoardRenderer) {}

    registerStep(step: WizardStep): void {
        this.steps.set(step.id, step);
    }

    async start(ctx: BotContext): Promise<void> {
        ctx.session.createGrid = {
            currentStep: SceneStep.Pair,
            stepHistory: [],
        };

        await this.renderCurrentStep(ctx);
    }

    async completeStep(ctx: BotContext, result: StepCompleted): Promise<void> {
        const state = ctx.session.createGrid;
        if (!state?.currentStep) {
            return;
        }

        if (!state.stepHistory) {
            state.stepHistory = [];
        }
        state.stepHistory.push(state.currentStep);
        state.currentStep = result.nextStep;

        await this.renderCurrentStep(ctx);
    }

    async handleBack(ctx: BotContext): Promise<void> {
        const state = ctx.session.createGrid;
        if (!state?.currentStep || !state.stepHistory) {
            return;
        }

        const previousStepId = state.stepHistory.pop();
        if (!previousStepId) {
            return;
        }

        const previousStep = this.steps.get(previousStepId);
        if (previousStep) {
            previousStep.rollbackState(ctx);
        }

        state.currentStep = previousStepId;
        state.pendingError = undefined;
        await this.renderCurrentStep(ctx);
    }

    async handleCancel(ctx: BotContext): Promise<void> {
        const state = ctx.session.createGrid;
        const hasStarted = (state?.stepHistory?.length ?? 0) > 0;

        if (state?.boardChatId && state?.boardMessageId) {
            try {
                await ctx.telegram.deleteMessage(state.boardChatId, state.boardMessageId);
            } catch (error) {
                this.logger.warn({ error }, 'Failed to delete board on cancel');
            }
        }

        delete ctx.session.createGrid;
        await ctx.scene.leave();

        if (hasStarted) {
            await ctx.reply(CommonTexts.GRID_CREATION_CANCELLED);
        }
    }

    async renderCurrentStep(ctx: BotContext): Promise<void> {
        const state = ctx.session.createGrid;
        const currentStepId = state?.currentStep;
        if (!currentStepId) {
            return;
        }

        const step = this.steps.get(currentStepId);
        if (!step) {
            return;
        }

        const view = await step.buildView(ctx);
        await this.boardRenderer.render(ctx, view);
        if (ctx.session.createGrid) {
            ctx.session.createGrid.pendingError = undefined;
        }
    }

    getCurrentStep(ctx: BotContext): SceneStep | null {
        return ctx.session.createGrid?.currentStep ?? null;
    }

    getStepInstance(stepId: SceneStep): WizardStep | undefined {
        return this.steps.get(stepId);
    }
}
