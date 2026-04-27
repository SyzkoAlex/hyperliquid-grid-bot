import { Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { ConnectAccountMessages } from '@components/telegram/core/domain/models/messages/wizard/connect-account.messages';
import { TelegramParseMode } from '@components/telegram/core/domain/models/telegram-parse-mode';
import { ConnectAccountSceneStep } from '../connect-account-scene-step';

function isValidEthereumAddress(address: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
}

@Injectable()
export class EnterAddressStep {
    async enter(ctx: BotContext): Promise<void> {
        if (!ctx.session.connectAccount) {
            ctx.session.connectAccount = {};
        }
        ctx.session.connectAccount.currentStep = ConnectAccountSceneStep.EnterAddress;
        await ctx.reply(ConnectAccountMessages.enterAddress(), {
            parse_mode: TelegramParseMode.HTML,
        });
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<boolean> {
        if (!isValidEthereumAddress(text)) {
            await ctx.reply(ConnectAccountMessages.invalidAddress());
            return false;
        }

        if (!ctx.session.connectAccount) {
            ctx.session.connectAccount = {};
        }
        ctx.session.connectAccount.accountAddress = text;
        return true;
    }
}
