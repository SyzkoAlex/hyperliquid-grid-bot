import { Inject, Injectable } from '@nestjs/common';
import { replyWithKeyboard } from '../helpers/keyboard.helper';
import { BotContext } from '../../../types/bot-context';
import { CreateGridCommandEvent } from '@domain/events/commands/create-grid-command.event';
import { EVENT_BUS, EventBus } from '@infra/events/event-bus.port';
import { CreateGridWizardState } from '../create-grid-wizard-state';
import { logger } from '@infra/logger/logger';

@Injectable()
export class ConfirmStep {
    constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBus) {}

    async execute(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        const state = session.createGrid;

        if (!this.validateState(state)) {
            await replyWithKeyboard(ctx, '❌ Invalid grid configuration. Please start over.');
            await ctx.scene.leave();
            return;
        }

        try {
            const event = CreateGridCommandEvent.create({
                symbol: state!.symbol!,
                upperPrice: state!.upperPrice!,
                lowerPrice: state!.lowerPrice!,
                levels: state!.levels!,
                totalInvestmentUSDC: state!.totalInvestmentUSDC,
                mode: 'neutral',
            });

            await this.eventBus.publish(event);

            await this.deleteLastMessages(ctx, 2);

            await replyWithKeyboard(
                ctx,
                `✅ <b>Grid creation started!</b>\n\n` +
                    `Symbol: ${state!.symbol}\n` +
                    `Price Range: ${state!.lowerPrice?.toFixed(4)} - ${state!.upperPrice?.toFixed(4)}\n` +
                    `Levels: ${state!.levels}\n` +
                    `Investment: ${state!.totalInvestmentUSDC} USDC\n\n` +
                    `You'll receive notifications when orders are placed.`,
                undefined,
                'HTML',
            );

            delete session.createGrid;
            await ctx.scene.leave();
        } catch (error) {
            await replyWithKeyboard(ctx, `❌ Failed to create grid. Please try again later.`);
            await ctx.scene.leave();
        }
    }

    private validateState(state: CreateGridWizardState | undefined): boolean {
        return !!(
            state?.symbol &&
            state?.upperPrice &&
            state?.lowerPrice &&
            state?.levels &&
            state?.totalInvestmentUSDC
        );
    }

    private async deleteLastMessages(ctx: BotContext, count: number): Promise<void> {
        const messageIds = ctx.session.createGrid?.messageIds;
        if (!messageIds || messageIds.length === 0) {
            return;
        }

        for (let i = 0; i < count && messageIds.length > 0; i++) {
            const messageId = messageIds.pop();
            if (messageId) {
                try {
                    await ctx.deleteMessage(messageId);
                } catch (error) {
                    logger.warn({ error, messageId }, 'Failed to delete message in confirm step');
                }
            }
        }
    }
}
