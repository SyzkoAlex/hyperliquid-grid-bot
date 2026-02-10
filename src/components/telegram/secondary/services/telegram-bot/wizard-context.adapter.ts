import { Markup } from 'telegraf';
import { WizardContext, WizardSession } from '../../../core/domain/wizard-context';
import { InlineButton } from '../../../core/domain/inline-button';
import { BotContext } from './types/bot-context';

export class TelegrafWizardContextAdapter implements WizardContext {
    constructor(private readonly botContext: BotContext) {}

    async reply(
        message: string,
        keyboard?: InlineButton[][],
        parseMode?: 'HTML' | 'Markdown',
    ): Promise<void> {
        const options: Record<string, unknown> = {};

        if (keyboard) {
            const buttons = keyboard.map((row) =>
                row.map((button) => Markup.button.callback(button.text, button.action)),
            );
            options.reply_markup = { inline_keyboard: buttons };
        }

        if (parseMode) {
            options.parse_mode = parseMode;
        }

        await this.botContext.reply(message, Object.keys(options).length > 0 ? options : undefined);
    }

    getSession(): WizardSession {
        return {
            createGrid: this.botContext.session.createGrid,
        };
    }

    async leaveScene(): Promise<void> {
        await this.botContext.scene.leave();
    }
}
