import { ActiveGreetingMessage } from './active-greeting-message';

export class EmptyGridsMessage {
    readonly text: string;

    private constructor(username?: string) {
        const greeting = ActiveGreetingMessage.create({ username }).text;
        this.text =
            `${greeting}\n\n` +
            '<b>Ready to launch your first grid?</b>\n\n' +
            'It takes less than a minute:\n\n' +
            '1. Tap ➕ Create Grid below.\n' +
            '2. Choose a token and select Quick start — the bot will suggest a price range and capital distribution based on the current price.\n' +
            '3. Review the parameters, tap Confirm — the bot will place the orders on the exchange.\n\n' +
            'After that the bot handles every fill automatically. Track progress and PnL in the 📊 Grids section.\n\n' +
            '💡 Tip: start with a small amount to watch the first rebalance cycle before scaling up.';
    }

    static create(params: { username?: string } = {}): EmptyGridsMessage {
        return new EmptyGridsMessage(params.username);
    }
}
