export class LandingMessage {
    readonly text =
        '<b>Hyperliquid Grid Bot</b>\n\n' +
        'Hey 👋 This bot helps you run grid strategies on Hyperliquid Spot — no terminals, no scripts, right from Telegram.\n\n' +
        'Pick a token, set a price range and capital — the bot places a grid of limit orders and manages it automatically: catches dips, locks in profit on every fill, and re-places orders.\n\n' +
        '<b>Safe by design.</b> It connects via an <a href="https://hyperliquid.gitbook.io/hyperliquid-docs/trading/api-wallets">agent wallet</a> — it can only trade, withdrawals are not possible. You can revoke access any time directly on Hyperliquid.\n\n' +
        '<b>Heads up:</b> we are not affiliated with Hyperliquid — this is an independent open-source tool. Trading carries financial risk, invest responsibly.';

    private constructor() {}

    static create(): LandingMessage {
        return new LandingMessage();
    }
}
