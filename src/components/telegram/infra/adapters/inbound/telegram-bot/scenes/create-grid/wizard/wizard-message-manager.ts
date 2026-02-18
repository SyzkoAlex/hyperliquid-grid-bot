import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/domain/models/inline-button';
import { SceneStep } from '../create-grid-scene-step';
import { logger } from '@infra/logger/logger';

@Injectable()
export class WizardMessageManager {
    async sendEnterMessage(
        ctx: BotContext,
        text: string,
        buttons?: InlineButton[][],
        parseMode: 'HTML' | 'Markdown' = 'HTML',
    ): Promise<void> {
        const state = ctx.session.createGrid;
        if (!state?.currentStep) {
            return;
        }

        let message;
        if (!buttons) {
            message = await ctx.reply(text, { parse_mode: parseMode });
        } else {
            const keyboard = Markup.inlineKeyboard(
                buttons.map((row) =>
                    row.map((btn) => Markup.button.callback(btn.text, btn.action)),
                ),
            );
            message = await ctx.reply(text, { parse_mode: parseMode, ...keyboard });
        }

        this.ensureStepMessages(state, state.currentStep);
        state.stepMessages![state.currentStep].enterMessageIds.push(message.message_id);
    }

    async sendConfirmation(ctx: BotContext, stepId: SceneStep, text: string): Promise<void> {
        const state = ctx.session.createGrid;
        if (!state) {
            return;
        }

        const message = await ctx.reply(text, { parse_mode: 'HTML' });

        this.ensureStepMessages(state, stepId);
        state.stepMessages![stepId].confirmationMessageIds.push(message.message_id);
    }

    async deleteEnterMessages(ctx: BotContext, stepId: SceneStep): Promise<void> {
        const messages = ctx.session.createGrid?.stepMessages?.[stepId]?.enterMessageIds || [];

        for (const messageId of messages) {
            try {
                await ctx.deleteMessage(messageId);
            } catch (error) {
                logger.warn({ error, messageId, stepId }, 'Failed to delete enter message');
            }
        }

        if (ctx.session.createGrid?.stepMessages?.[stepId]) {
            ctx.session.createGrid.stepMessages[stepId].enterMessageIds = [];
        }
    }

    async deleteConfirmationMessages(ctx: BotContext, stepId: SceneStep): Promise<void> {
        const messages =
            ctx.session.createGrid?.stepMessages?.[stepId]?.confirmationMessageIds || [];

        for (const messageId of messages) {
            try {
                await ctx.deleteMessage(messageId);
            } catch (error) {
                logger.warn({ error, messageId, stepId }, 'Failed to delete confirmation message');
            }
        }

        if (ctx.session.createGrid?.stepMessages?.[stepId]) {
            ctx.session.createGrid.stepMessages[stepId].confirmationMessageIds = [];
        }
    }

    async deleteAllMessages(ctx: BotContext): Promise<void> {
        const stepMessages = ctx.session.createGrid?.stepMessages;
        if (!stepMessages) {
            return;
        }

        for (const stepId of Object.keys(stepMessages)) {
            const messages = stepMessages[stepId];
            const allMessageIds = [...messages.enterMessageIds, ...messages.confirmationMessageIds];

            for (const messageId of allMessageIds) {
                try {
                    await ctx.deleteMessage(messageId);
                } catch (error) {
                    logger.warn(
                        { error, messageId, stepId },
                        'Failed to delete message during cleanup',
                    );
                }
            }
        }
    }

    initStep(ctx: BotContext, stepId: SceneStep): void {
        const state = ctx.session.createGrid;
        if (!state) {
            return;
        }

        this.ensureStepMessages(state, stepId);
        state.stepMessages![stepId] = {
            enterMessageIds: [],
            confirmationMessageIds: [],
        };
    }

    private ensureStepMessages(state: any, stepId: SceneStep): void {
        if (!state.stepMessages) {
            state.stepMessages = {};
        }
        if (!state.stepMessages[stepId]) {
            state.stepMessages[stepId] = {
                enterMessageIds: [],
                confirmationMessageIds: [],
            };
        }
    }
}
