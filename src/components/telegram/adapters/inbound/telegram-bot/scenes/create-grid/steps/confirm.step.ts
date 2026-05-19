import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { CreateGridUseCase } from '@components/telegram/core/application/use-cases/create-grid/create-grid.use-case';
import { PendingCreationMessageStore } from '../../../pending-creation-message.store';
import { CreateGridWizardState } from '../create-grid-wizard-state';
import { GridCreatingMessage } from '@components/telegram/core/domain/models/messages/wizard/confirm.messages';
import { ValidationTexts } from '@components/telegram/core/domain/models/messages/wizard/validation.texts';
import { logger } from '@/infra/logger/logger';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { CommonTexts } from '@components/telegram/core/domain/models/messages/common.texts';

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
            await ctx.reply(ValidationTexts.invalidGridConfig());
            return;
        }

        const sentMessage = await ctx.reply(
            GridCreatingMessage.create({
                symbol: state!.symbol!,
                lowerPrice: state!.lowerPrice!,
                upperPrice: state!.upperPrice!,
                levels: state!.levels!,
                totalInvestment: state!.totalInvestmentUSDC,
            }).text,
            { parse_mode: TelegramParseMode.HTML },
        );

        this.pendingCreationMessageStore.save(sentMessage.chat.id, sentMessage.message_id);

        const accountAddress = ctx.user?.accountAddress;
        if (!accountAddress) {
            await ctx.reply(CommonTexts.ACCOUNT_NOT_CONNECTED);
            return;
        }

        void this.createGridUseCase
            .execute({
                userId: ctx.user!.id,
                symbol: state!.symbol!,
                lowerPrice: state!.lowerPrice!,
                upperPrice: state!.upperPrice!,
                levels: state!.levels!,
                totalInvestmentUSDC: state!.totalInvestmentUSDC,
                accountAddress,
                stopLossEnabled: state!.stopLossEnabled,
                stopLossPrice: state!.stopLossPrice,
            })
            .catch((error) => {
                this.logger.error({ error }, 'Grid creation failed unexpectedly');
            });
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
}
