import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { ConnectAccountMessages } from '@components/telegram/core/domain/models/messages/wizard/connect-account.messages';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { toInlineKeyboard } from '../../../handlers/inline-keyboard';
import { CONNECT_ACCOUNT_ACTIONS } from '../connect-account-actions';
import { VerifyAgentUseCase } from '@components/telegram/core/application/use-cases/verify-agent/verify-agent.use-case';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';

@Injectable()
export class VerifyApprovalStep {
    constructor(private readonly verifyAgentUseCase: VerifyAgentUseCase) {}

    async execute(ctx: BotContext): Promise<void> {
        const state = ctx.session.connectAccount;
        if (!state?.userId || !state?.accountAddress) {
            await ctx.reply(ConnectAccountMessages.SESSION_EXPIRED);
            await ctx.scene.leave();
            return;
        }

        await ctx.reply(ConnectAccountMessages.verifying());

        const { success } = await this.verifyAgentUseCase.execute(state.userId);

        if (success) {
            delete ctx.session.connectAccount;
            await ctx.reply(ConnectAccountMessages.approvalSuccess(), {
                parse_mode: TelegramParseMode.HTML,
            });
            await ctx.scene.leave();
        } else {
            const keyboard = toInlineKeyboard([
                [
                    {
                        text: ConnectAccountMessages.RETRY_BUTTON_TEXT,
                        action: CONNECT_ACCOUNT_ACTIONS.RETRY,
                    },
                    { text: BUTTON_LABELS.CANCEL, action: CONNECT_ACCOUNT_ACTIONS.CANCEL },
                ],
            ]);
            await ctx.reply(ConnectAccountMessages.approvalFailed(), { ...keyboard });
        }
    }
}
