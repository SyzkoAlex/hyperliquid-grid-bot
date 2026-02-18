import { TelegramMessage } from './telegram-message';

export class HelpMessage extends TelegramMessage {
    protected readonly text =
        '<b>📋 Commands</b>\n\n' +
        '/start — Main menu\n' +
        '/grids — Active grids\n' +
        '/balance — Account balance\n' +
        '/stats — Trading statistics\n' +
        '/help — This help\n\n' +
        '<b>💡 Quick Start</b>\n' +
        'Use menu buttons to navigate. Press <b>Create Grid</b> to start a new strategy.\n\n' +
        '<b>🐛 Support</b>\n' +
        '<a href="https://github.com/SyzkoAlex/hyperliquid-grid-bot/issues">Report an issue</a>';
}
