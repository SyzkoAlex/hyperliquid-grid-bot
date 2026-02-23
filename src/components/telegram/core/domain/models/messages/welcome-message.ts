import { TelegramMessage } from './telegram-message';

export class WelcomeMessage extends TelegramMessage {
    protected readonly text = '<b>Hyperliquid Grid Bot</b>\n\nManage your grid trading strategies.';
}
