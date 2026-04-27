import { Injectable } from '@nestjs/common';
import { Scenes } from 'telegraf';
import { BotContext } from '../../types/bot-context';
import { EnterAddressStep } from './steps/enter-address.step';
import { ApproveAgentStep } from './steps/approve-agent.step';
import { VerifyApprovalStep } from './steps/verify-approval.step';
import { CONNECT_ACCOUNT_ACTIONS } from './connect-account-actions';
import { ConnectAccountSceneStep } from './connect-account-scene-step';
import { ConnectAccountMessages } from '@components/telegram/core/domain/models/messages/wizard/connect-account.messages';
import { SceneHandler } from '../scene-handler';
import { logger } from '@/infra/logger/logger';

export const CONNECT_ACCOUNT_SCENE_ID = 'connect_account';

@Injectable()
export class ConnectAccountSceneHandler implements SceneHandler {
    readonly id = CONNECT_ACCOUNT_SCENE_ID;
    private readonly logger = logger.child({ context: ConnectAccountSceneHandler.name });

    constructor(
        private readonly enterAddressStep: EnterAddressStep,
        private readonly approveAgentStep: ApproveAgentStep,
        private readonly verifyApprovalStep: VerifyApprovalStep,
    ) {}

    createScene(): Scenes.BaseScene<BotContext> {
        const scene = new Scenes.BaseScene<BotContext>(CONNECT_ACCOUNT_SCENE_ID);

        scene.enter((ctx) => this.handleEnter(ctx));

        scene.action(CONNECT_ACCOUNT_ACTIONS.DONE, (ctx) => this.handleDone(ctx));
        scene.action(CONNECT_ACCOUNT_ACTIONS.RETRY, (ctx) => this.handleRetry(ctx));
        scene.action(CONNECT_ACCOUNT_ACTIONS.CANCEL, (ctx) => this.handleCancel(ctx));

        scene.on('text', (ctx) => this.handleTextInput(ctx));

        return scene;
    }

    private async handleEnter(ctx: BotContext): Promise<void> {
        await this.enterAddressStep.enter(ctx);
    }

    private async handleDone(ctx: BotContext): Promise<void> {
        try {
            await ctx.answerCbQuery();
            await this.verifyApprovalStep.execute(ctx);
        } catch (error) {
            this.logger.error({ error }, 'Error in connect_account:done action');
        }
    }

    private async handleRetry(ctx: BotContext): Promise<void> {
        try {
            await ctx.answerCbQuery();
            await this.verifyApprovalStep.execute(ctx);
        } catch (error) {
            this.logger.error({ error }, 'Error in connect_account:retry action');
        }
    }

    private async handleCancel(ctx: BotContext): Promise<void> {
        try {
            await ctx.answerCbQuery();
            delete ctx.session.connectAccount;
            await ctx.reply(ConnectAccountMessages.cancelled());
            await ctx.scene.leave();
        } catch (error) {
            this.logger.error({ error }, 'Error in connect_account:cancel action');
        }
    }

    private async handleTextInput(ctx: BotContext): Promise<void> {
        if (!ctx.message || !('text' in ctx.message)) return;

        const text = ctx.message.text;
        if (text.startsWith('/')) {
            await ctx.scene.leave();
            return;
        }

        const currentStep = ctx.session.connectAccount?.currentStep;

        if (currentStep === ConnectAccountSceneStep.EnterAddress) {
            const valid = await this.enterAddressStep.handleTextInput(ctx, text);
            if (valid) {
                await this.approveAgentStep.enter(ctx);
            }
        }
    }
}
