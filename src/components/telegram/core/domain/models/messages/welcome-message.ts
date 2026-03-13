export class WelcomeMessage {
    readonly text = '<b>Hyperliquid Grid Bot</b>\n\nManage your grid trading strategies.';

    private constructor() {}

    static create(): WelcomeMessage {
        return new WelcomeMessage();
    }
}
