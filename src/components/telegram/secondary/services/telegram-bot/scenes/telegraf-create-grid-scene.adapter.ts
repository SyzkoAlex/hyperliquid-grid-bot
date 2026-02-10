import { Injectable } from '@nestjs/common';
import { Scenes } from 'telegraf';
import { TelegrafSceneAdapter } from '../scene-adapter';
import { BotContext } from '../types/bot-context';
import { TelegrafWizardContextAdapter } from '../wizard-context.adapter';
import {
    CreateGridSceneHandler,
    CREATE_GRID_SCENE_ID,
} from '../../../../controllers/telegram-commands/scenes/create-grid/create-grid.scene';
import { CreateGridMode } from '../../../../core/domain/grid-mode';

@Injectable()
export class TelegrafCreateGridSceneAdapter extends TelegrafSceneAdapter {
    readonly id = CREATE_GRID_SCENE_ID;

    constructor(private readonly handler: CreateGridSceneHandler) {
        super();
    }

    protected createScene(): Scenes.BaseScene<BotContext> {
        const scene = new Scenes.BaseScene<BotContext>(CREATE_GRID_SCENE_ID);
        this.registerHandlers(scene);
        return scene;
    }

    private registerHandlers(scene: Scenes.BaseScene<BotContext>): void {
        scene.enter((ctx) => this.handleEnter(ctx));

        scene.action(/^create_grid:pair:(.+)$/, (ctx) => this.handlePairAction(ctx));
        scene.action('create_grid:other_pair', (ctx) => this.handleOtherPairAction(ctx));

        scene.action('create_grid:mode:quick', (ctx) =>
            this.handleModeAction(ctx, CreateGridMode.Quick),
        );
        scene.action('create_grid:mode:advanced', (ctx) =>
            this.handleModeAction(ctx, CreateGridMode.Advanced),
        );

        scene.action(/^create_grid:levels:(.+)$/, (ctx) => this.handleLevelsAction(ctx));

        scene.action('create_grid:confirm', (ctx) => this.handleConfirmAction(ctx));
        scene.action('create_grid:back', (ctx) => this.handleBackAction(ctx));
        scene.action('create_grid:cancel', (ctx) => this.handleCancelAction(ctx));

        scene.on('text', (ctx) => this.handleTextInput(ctx));
    }

    private async handleEnter(ctx: BotContext): Promise<void> {
        const wizardCtx = new TelegrafWizardContextAdapter(ctx);
        await this.handler.handleEnter(wizardCtx);
    }

    private async handlePairAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        if (!('match' in ctx) || !ctx.match) {
            return;
        }
        const match = ctx.match as RegExpMatchArray;
        const symbol = match[1] || '';

        const wizardCtx = new TelegrafWizardContextAdapter(ctx);
        await this.handler.handlePairSelection(wizardCtx, symbol);
    }

    private async handleOtherPairAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const wizardCtx = new TelegrafWizardContextAdapter(ctx);
        await this.handler.handleOtherPair(wizardCtx);
    }

    private async handleModeAction(ctx: BotContext, mode: CreateGridMode): Promise<void> {
        await ctx.answerCbQuery();
        const wizardCtx = new TelegrafWizardContextAdapter(ctx);
        await this.handler.handleModeSelection(wizardCtx, mode);
    }

    private async handleLevelsAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        if (!('match' in ctx) || !ctx.match) {
            return;
        }
        const match = ctx.match as RegExpMatchArray;
        const levels = parseInt(match[1] || '0', 10);

        const wizardCtx = new TelegrafWizardContextAdapter(ctx);
        await this.handler.handleLevelsSelection(wizardCtx, levels);
    }

    private async handleConfirmAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const wizardCtx = new TelegrafWizardContextAdapter(ctx);
        await this.handler.handleConfirm(wizardCtx);
    }

    private async handleBackAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const wizardCtx = new TelegrafWizardContextAdapter(ctx);
        await this.handler.handleBack(wizardCtx);
    }

    private async handleCancelAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        const wizardCtx = new TelegrafWizardContextAdapter(ctx);
        await this.handler.handleCancel(wizardCtx);
    }

    private async handleTextInput(ctx: BotContext): Promise<void> {
        if (!ctx.message || !('text' in ctx.message)) {
            return;
        }

        const text = ctx.message.text;
        const wizardCtx = new TelegrafWizardContextAdapter(ctx);
        await this.handler.handleTextInput(wizardCtx, text);
    }
}
