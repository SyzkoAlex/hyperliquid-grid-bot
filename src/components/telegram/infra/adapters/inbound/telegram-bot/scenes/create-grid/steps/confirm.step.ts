import { Inject, Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { EVENT_BUS, EventBus } from '@infra/events/event-bus.port';
import { CreateGridWizardState } from '../create-grid-wizard-state';
import { ConfirmMessages } from '@components/telegram/domain/models/messages/wizard/confirm.messages';
import { ValidationMessages } from '@components/telegram/domain/models/messages/wizard/validation.messages';

@Injectable()
export class ConfirmStep {
    constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBus) {}

    async execute(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        const state = session.createGrid;

        if (!this.validateState(state)) {
            await ctx.reply(ValidationMessages.invalidGridConfig());
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
            ConfirmMessages.success(
                state!.symbol!,
                state!.lowerPrice!,
                state!.upperPrice!,
                state!.levels!,
                state!.totalInvestmentUSDC,
            ),
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
