export class LandingMessage {
    readonly text =
        'Hey 👋 This bot helps you run grid strategies on Hyperliquid Spot — no terminals, no scripts, right from Telegram.';

    private constructor() {}

    static create(): LandingMessage {
        return new LandingMessage();
    }
}
