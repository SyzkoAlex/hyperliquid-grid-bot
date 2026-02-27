import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { CreateGridUseCase } from '@components/telegram/core/application/use-cases/create-grid/create-grid.use-case';
import { PendingCreationMessageStore } from '@components/telegram/core/application/services/pending-creation-message.store';
import { CreateGridWizardState } from '../create-grid-wizard-state';
import { ConfirmMessages } from '@components/telegram/core/domain/models/messages/wizard/confirm.messages';
import { ValidationMessages } from '@components/telegram/core/domain/models/messages/wizard/validation.messages';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class ConfirmStep {
    private readonly logger = logger.child({ context: ConfirmStep.name });

    constructor(
        private readonly createGridUseCase: CreateGridUseCase,
        private readonly pendingCreationMessageStore: PendingCreationMessageStore,
    ) {}

    async execute(ctx: BotContext): Promise<void> {
        const session = ctx.session;
        const state = session.createGrid;

        if (!this.validateState(state)) {
            await ctx.reply(ValidationMessages.invalidGridConfig());
            return;
        }

        const sentMessage = await ctx.reply(
            ConfirmMessages.creating(
                state!.symbol!,
                state!.lowerPrice!,
                state!.upperPrice!,
                state!.levels!,
                state!.totalInvestmentUSDC,
            ),
            { parse_mode: 'HTML' },
        );

        this.pendingCreationMessageStore.save(sentMessage.chat.id, sentMessage.message_id);

        void this.createGridUseCase
            .execute({
                symbol: state!.symbol!,
                mode: state!.gridMode!,
                lowerPrice: state!.lowerPrice!,
                upperPrice: state!.upperPrice!,
                levels: state!.levels!,
                totalInvestmentUSDC: state!.totalInvestmentUSDC,
            })
            .catch((error) => {
                this.logger.error({ error }, 'Grid creation failed unexpectedly');
            });
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
