import { Inject, Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { CreateGridCommandEvent } from '@domain/events/commands/create-grid-command.event';
import { EVENT_BUS, EventBus } from '@infra/events/event-bus.port';
import { CreateGridWizardState } from '../create-grid-wizard-state';

@Injectable()
export class ConfirmStep {
    constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBus) {}

    async execute(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        const state = session.createGrid;

        if (!this.validateState(state)) {
            await ctx.reply('❌ Invalid grid configuration. Please start over.');
            return;
        }

        const event = CreateGridCommandEvent.create({
            symbol: state!.symbol!,
            upperPrice: state!.upperPrice!,
            lowerPrice: state!.lowerPrice!,
            levels: state!.levels!,
            totalInvestmentUSDC: state!.totalInvestmentUSDC,
            mode: state!.gridMode!,
        });

        await this.eventBus.publish(event);

        await ctx.reply(
            `✅ <b>Grid creation started!</b>\n\n` +
                `Symbol: ${state!.symbol}\n` +
                `Price Range: ${state!.lowerPrice?.toFixed(4)} - ${state!.upperPrice?.toFixed(4)}\n` +
                `Levels: ${state!.levels}\n` +
                `Investment: ${state!.totalInvestmentUSDC} USDC\n\n` +
                `You'll receive notifications when orders are placed.`,
            { parse_mode: 'HTML' },
        );
    }

    private validateState(state: CreateGridWizardState | undefined): boolean {
        return !!(
            state?.symbol &&
            state?.gridMode &&
            state?.upperPrice &&
            state?.lowerPrice &&
            state?.levels &&
            state?.totalInvestmentUSDC
        );
    }
}
