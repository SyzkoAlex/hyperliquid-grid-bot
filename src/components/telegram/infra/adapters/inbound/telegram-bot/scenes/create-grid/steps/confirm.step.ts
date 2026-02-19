import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { CreateGridUseCase } from '@components/telegram/application/use-cases/create-grid/create-grid.use-case';
import { CreateGridWizardState } from '../create-grid-wizard-state';
import { ConfirmMessages } from '@components/telegram/domain/models/messages/wizard/confirm.messages';
import { ValidationMessages } from '@components/telegram/domain/models/messages/wizard/validation.messages';

@Injectable()
export class ConfirmStep {
    constructor(private readonly createGridUseCase: CreateGridUseCase) {}

    async execute(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        const state = session.createGrid;

        if (!this.validateState(state)) {
            await ctx.reply(ValidationMessages.invalidGridConfig());
            return;
        }

        await this.createGridUseCase.execute({
            symbol: state!.symbol!,
            mode: state!.gridMode!,
            lowerPrice: state!.lowerPrice!,
            upperPrice: state!.upperPrice!,
            levels: state!.levels!,
            totalInvestmentUSDC: state!.totalInvestmentUSDC,
        });

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
