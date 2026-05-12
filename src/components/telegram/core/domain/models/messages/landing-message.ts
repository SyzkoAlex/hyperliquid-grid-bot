export class LandingMessage {
    readonly text =
        '<b>Hyperliquid Grid Bot</b>\n\n' +
        'Automated grid trading for Hyperliquid spot pairs.\n\n' +
        '<b>What it does</b>\n' +
        'Places buy and sell orders across a price range you choose. Each time price crosses a level the bot rebalances and locks in a small profit. Works best in sideways, oscillating markets.\n\n' +
        '<b>How to start</b>\n' +
        '1. Connect your Hyperliquid account (via an agent wallet — read more on the next screen)\n' +
        '2. Press <b>Create Grid</b> and pick a token, range, and capital\n' +
        '3. The bot manages orders for you\n\n' +
        '<b>⚠️ Disclaimer</b>\n' +
        'This bot is <b>not affiliated with or endorsed by Hyperliquid</b>. It is an independent tool that interacts with the Hyperliquid public API. Trading involves financial risk — only use funds you can afford to lose. The authors provide no warranty and accept no liability for losses.';

    private constructor() {}

    static create(): LandingMessage {
        return new LandingMessage();
    }
}
