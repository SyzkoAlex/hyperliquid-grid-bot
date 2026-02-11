import { Injectable } from '@nestjs/common';
import { Scenes } from 'telegraf';
import { CreateGridMode } from './create-grid-mode';
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
import { BotContext } from '../../types/bot-context';
import { CreateGridWizardState } from './create-grid-wizard-state';
import { CREATE_GRID_ACTIONS, CREATE_GRID_PATTERNS } from './create-grid-actions';

export const CREATE_GRID_SCENE_ID = 'create_grid';

@Injectable()
export class CreateGridSceneHandler {
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

    createScene(): Scenes.BaseScene<BotContext> {
        const scene = new Scenes.BaseScene<BotContext>(CREATE_GRID_SCENE_ID);

        scene.enter((ctx) => this.handleEnter(ctx));

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

    private async handleEnter(ctx: BotContext): Promise<void> {
        ctx.session.createGrid = {};
        await this.selectPairStep.enter(ctx);
    }

    private async handlePairAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        if (!('match' in ctx) || !ctx.match) {
            return;
        }
        const match = ctx.match as RegExpMatchArray;
        const symbol = match[1] || '';

        await this.handlePairSelection(ctx, symbol);
    }

    private async handleOtherPairAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await this.handleOtherPair(ctx);
    }

    private async handleModeAction(ctx: BotContext, mode: CreateGridMode): Promise<void> {
        await ctx.answerCbQuery();
        await this.handleModeSelection(ctx, mode);
    }

    private async handleLevelsAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        if (!('match' in ctx) || !ctx.match) {
            return;
        }
        const match = ctx.match as RegExpMatchArray;
        const levels = parseInt(match[1] || '0', 10);

        await this.handleLevelsSelection(ctx, levels);
    }

    private async handleConfirmAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await this.handleConfirm(ctx);
    }

    private async handleBackAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await this.handleBack(ctx);
    }

    private async handleCancelAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await this.handleCancel(ctx);
    }

    private async handleTextInput(ctx: BotContext): Promise<void> {
        if (!ctx.message || !('text' in ctx.message)) {
            return;
        }

        const text = ctx.message.text;
        const currentStep = this.getCurrentStep(ctx.session.createGrid);

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

    private async handlePairSelection(ctx: BotContext, symbol: string): Promise<void> {
        const result = await this.selectPairStep.handlePairSelection(ctx, symbol);
        if (result === SceneStep.Mode) {
            await this.selectModeStep.enter(ctx);
        }
    }

    private async handleOtherPair(ctx: BotContext): Promise<void> {
        await this.selectPairStep.handleOtherPair(ctx);
    }

    private async handleModeSelection(ctx: BotContext, mode: CreateGridMode): Promise<void> {
        const result = await this.selectModeStep.handleModeSelection(ctx, mode);

        if (result === SceneStep.Quick) {
            await this.quickStartStep.enter(ctx);
        } else {
            await this.advancedUpperStep.enter(ctx);
        }
    }

    private async handleLevelsSelection(ctx: BotContext, levels: number): Promise<void> {
        const result = await this.advancedLevelsStep.handleLevelsSelection(ctx, levels);
        if (result === SceneStep.Investment) {
            await this.advancedInvestmentStep.enter(ctx);
        }
    }

    private async handleConfirm(ctx: BotContext): Promise<void> {
        await this.confirmStep.execute(ctx);
    }

    private async handleBack(ctx: BotContext): Promise<void> {
        const currentStep = this.getCurrentStep(ctx.session.createGrid);

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
                if (ctx.session.createGrid?.mode === CreateGridMode.Quick) {
                    await this.quickStartStep.enter(ctx);
                } else {
                    await this.advancedInvestmentStep.enter(ctx);
                }
                break;
        }
    }

    private async handleCancel(ctx: BotContext): Promise<void> {
        delete ctx.session.createGrid;
        await ctx.scene.leave();
        await ctx.reply('❌ Grid creation cancelled');
    }

    private getCurrentStep(state: CreateGridWizardState | undefined): SceneStep {
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
