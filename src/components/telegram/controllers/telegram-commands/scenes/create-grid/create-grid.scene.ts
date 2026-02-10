import { Injectable } from '@nestjs/common';
import { SceneHandler } from '../../../../core/domain/scene';
import { WizardContext, WizardSession } from '../../../../core/domain/wizard-context';
import { CreateGridMode } from '../../../../core/domain/grid-mode';
import { SceneStep } from './create-grid-scene-step';
import { SelectPairStep } from './steps/select-pair.step';
import { SelectModeStep } from './steps/select-mode.step';
import { QuickStartStep } from './steps/quick-start.step';
import { AdvancedUpperStep } from './steps/advanced-upper.step';
import { AdvancedLowerStep } from './steps/advanced-lower.step';
import { AdvancedLevelsStep } from './steps/advanced-levels.step';
import { AdvancedInvestmentStep } from './steps/advanced-investment.step';
import { AdvancedPreviewStep } from './steps/advanced-preview.step';
import { ConfirmStep } from './steps/confirm.step';

export const CREATE_GRID_SCENE_ID = 'create_grid';

@Injectable()
export class CreateGridSceneHandler implements SceneHandler {
    readonly id = CREATE_GRID_SCENE_ID;

    constructor(
        private readonly selectPairStep: SelectPairStep,
        private readonly selectModeStep: SelectModeStep,
        private readonly quickStartStep: QuickStartStep,
        private readonly advancedUpperStep: AdvancedUpperStep,
        private readonly advancedLowerStep: AdvancedLowerStep,
        private readonly advancedLevelsStep: AdvancedLevelsStep,
        private readonly advancedInvestmentStep: AdvancedInvestmentStep,
        private readonly advancedPreviewStep: AdvancedPreviewStep,
        private readonly confirmStep: ConfirmStep,
    ) {}

    async handleEnter(ctx: WizardContext): Promise<void> {
        const session = ctx.getSession();
        session.createGrid = {};
        await this.selectPairStep.enter(ctx);
    }

    async handlePairSelection(ctx: WizardContext, symbol: string): Promise<void> {
        const result = await this.selectPairStep.handlePairSelection(ctx, symbol);
        if (result === SceneStep.Mode) {
            await this.selectModeStep.enter(ctx);
        }
    }

    async handleOtherPair(ctx: WizardContext): Promise<void> {
        await this.selectPairStep.handleOtherPair(ctx);
    }

    async handleModeSelection(ctx: WizardContext, mode: CreateGridMode): Promise<void> {
        const result = await this.selectModeStep.handleModeSelection(ctx, mode);

        if (result === SceneStep.Quick) {
            await this.quickStartStep.enter(ctx);
        } else {
            await this.advancedUpperStep.enter(ctx);
        }
    }

    async handleLevelsSelection(ctx: WizardContext, levels: number): Promise<void> {
        const result = await this.advancedLevelsStep.handleLevelsSelection(ctx, levels);
        if (result === SceneStep.Investment) {
            await this.advancedInvestmentStep.enter(ctx);
        }
    }

    async handleConfirm(ctx: WizardContext): Promise<void> {
        await this.confirmStep.execute(ctx);
    }

    async handleBack(ctx: WizardContext): Promise<void> {
        const session = ctx.getSession();
        const currentStep = this.getCurrentStep(session);

        switch (currentStep) {
            case SceneStep.Mode:
                await this.selectModeStep.handleBack(ctx);
                await this.selectPairStep.enter(ctx);
                break;
            case SceneStep.Quick:
                await this.quickStartStep.handleBack(ctx);
                await this.selectModeStep.enter(ctx);
                break;
            case SceneStep.Upper:
                await this.advancedUpperStep.handleBack(ctx);
                await this.selectModeStep.enter(ctx);
                break;
            case SceneStep.Lower:
                await this.advancedLowerStep.handleBack(ctx);
                await this.advancedUpperStep.enter(ctx);
                break;
            case SceneStep.Levels:
                await this.advancedLevelsStep.handleBack(ctx);
                await this.advancedLowerStep.enter(ctx);
                break;
            case SceneStep.Investment:
                await this.advancedInvestmentStep.handleBack(ctx);
                await this.advancedLevelsStep.enter(ctx);
                break;
            case SceneStep.Preview:
                await this.advancedPreviewStep.handleBack(ctx);
                if (session.createGrid?.mode === CreateGridMode.Quick) {
                    await this.quickStartStep.enter(ctx);
                } else {
                    await this.advancedInvestmentStep.enter(ctx);
                }
                break;
        }
    }

    async handleCancel(ctx: WizardContext): Promise<void> {
        const session = ctx.getSession();
        delete session.createGrid;
        await ctx.leaveScene();
        await ctx.reply('❌ Grid creation cancelled');
    }

    async handleTextInput(ctx: WizardContext, text: string): Promise<void> {
        const session = ctx.getSession();
        const currentStep = this.getCurrentStep(session);

        let result: string | null = null;

        switch (currentStep) {
            case SceneStep.Pair:
                result = await this.selectPairStep.handleTextInput(ctx, text);
                if (result === SceneStep.Mode) {
                    await this.selectModeStep.enter(ctx);
                }
                break;
            case SceneStep.Quick:
                result = await this.quickStartStep.handleInvestmentInput(ctx, text);
                if (result === SceneStep.Preview) {
                    await this.advancedPreviewStep.enter(ctx);
                }
                break;
            case SceneStep.Upper:
                result = await this.advancedUpperStep.handlePriceInput(ctx, text);
                if (result === SceneStep.Lower) {
                    await this.advancedLowerStep.enter(ctx);
                }
                break;
            case SceneStep.Lower:
                result = await this.advancedLowerStep.handlePriceInput(ctx, text);
                if (result === SceneStep.Levels) {
                    await this.advancedLevelsStep.enter(ctx);
                }
                break;
            case SceneStep.Levels:
                result = await this.advancedLevelsStep.handleTextInput(ctx, text);
                if (result === SceneStep.Investment) {
                    await this.advancedInvestmentStep.enter(ctx);
                }
                break;
            case SceneStep.Investment:
                result = await this.advancedInvestmentStep.handleInvestmentInput(ctx, text);
                if (result === SceneStep.Preview) {
                    await this.advancedPreviewStep.enter(ctx);
                }
                break;
        }
    }

    private getCurrentStep(session: WizardSession): SceneStep {
        const state = session.createGrid;

        if (!state?.symbol) return SceneStep.Pair;
        if (!state.mode) return SceneStep.Mode;

        if (state.mode === CreateGridMode.Quick) {
            if (!state.totalInvestmentUSDC) return SceneStep.Quick;
            return SceneStep.Preview;
        }

        if (!state.upperPrice) return SceneStep.Upper;
        if (!state.lowerPrice) return SceneStep.Lower;
        if (!state.levels) return SceneStep.Levels;
        if (!state.totalInvestmentUSDC) return SceneStep.Investment;
        return SceneStep.Preview;
    }
}
