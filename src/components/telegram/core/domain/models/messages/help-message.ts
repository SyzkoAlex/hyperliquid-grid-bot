export class HelpMessage {
    readonly text =
        '<b>🤖 Hyperliquid Grid Bot</b>\n\n' +
        'Automates grid trading on Hyperliquid perpetuals.\n\n' +
        '<b>💡 How it works</b>\n' +
        'Bot places buy and sell orders across a price range. Each time price crosses a level — a trade executes and profit is locked in. Works best in sideways, oscillating markets.\n\n' +
        '<b>🚀 Quick Start</b>\n' +
        '1. Press <b>Create Grid</b>\n' +
        '2. Choose token and set price range + capital\n' +
        '3. Bot manages orders automatically\n\n' +
        '<b>⚠️ Risk Warning</b>\n' +
        'Trading involves financial risk. Only use funds you can afford to lose.\n\n' +
        '<b>🐛 Support</b>\n' +
        '<a href="https://github.com/SyzkoAlex/hyperliquid-grid-bot/issues">Report an issue</a>';

    private constructor() {}

    static create(): HelpMessage {
        return new HelpMessage();
    }
}
