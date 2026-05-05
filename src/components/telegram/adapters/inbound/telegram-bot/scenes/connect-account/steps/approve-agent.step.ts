import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotContext } from '../../../types/bot-context';
import { ConnectAccountMessages } from '@components/telegram/core/domain/models/messages/wizard/connect-account.messages';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { toInlineKeyboard } from '../../../handlers/inline-keyboard';
import { CONNECT_ACCOUNT_ACTIONS } from '../connect-account-actions';
import { ConnectAccountUseCase } from '@components/telegram/core/application/use-cases/connect-account/connect-account.use-case';
import { ConnectAccountSceneStep } from '../connect-account-scene-step';
import { Config } from '@/config/config.schema';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';

@Injectable()
export class ApproveAgentStep {
    private readonly isMainnet: boolean;

    constructor(
        private readonly connectAccountUseCase: ConnectAccountUseCase,
        private readonly configService: ConfigService<Config, true>,
    ) {
        this.isMainnet = !this.configService.get('hyperliquid', { infer: true }).testnet;
    }

    async enter(ctx: BotContext): Promise<void> {
        const state = ctx.session.connectAccount;
        if (!state?.accountAddress || !ctx.chat) {
            await ctx.reply(ConnectAccountMessages.SESSION_EXPIRED);
            await ctx.scene.leave();
            return;
        }

        const { user, agentAddress } = await this.connectAccountUseCase.execute(
            ctx.chat.id,
            state.accountAddress,
        );

        ctx.session.connectAccount = {
            ...state,
            userId: user.id,
            agentAddress,
            currentStep: ConnectAccountSceneStep.ApproveAgent,
        };

        const apiUrl = this.isMainnet
            ? 'https://app.hyperliquid.xyz/API'
            : 'https://app.hyperliquid-testnet.xyz/API';

        const text = ConnectAccountMessages.approveAgent(agentAddress, this.isMainnet);
        const keyboard = toInlineKeyboard([
            [{ text: 'Open Hyperliquid API Settings', url: apiUrl }],
            [
                { text: BUTTON_LABELS.CONFIRM, action: CONNECT_ACCOUNT_ACTIONS.DONE },
                { text: BUTTON_LABELS.CANCEL, action: CONNECT_ACCOUNT_ACTIONS.CANCEL },
            ],
        ]);

        await ctx.reply(text, { parse_mode: TelegramParseMode.HTML, ...keyboard });
    }
}
