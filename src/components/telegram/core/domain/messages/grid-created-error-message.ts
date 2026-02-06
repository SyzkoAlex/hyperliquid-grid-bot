import { TelegramMessage } from './telegram-message';

export class GridCreatedErrorMessage extends TelegramMessage {
    protected readonly text: string;

    constructor(error: string) {
        super();
        this.text =
            `❌ <b>Grid Creation Failed</b>\n\n` +
            `<b>Error:</b> ${error}\n\n` +
            `Please check your balance and parameters, then try again.`;
    }
}
