import { TelegramCommand } from '../telegram-command';

export const BOT_COMMANDS = [
    { command: TelegramCommand.Start, description: 'Main menu' },
    { command: TelegramCommand.Grids, description: 'Active grids' },
    { command: TelegramCommand.Balance, description: 'Balance' },
    { command: TelegramCommand.Settings, description: 'Settings' },
    { command: TelegramCommand.Help, description: 'Help' },
] as const;
