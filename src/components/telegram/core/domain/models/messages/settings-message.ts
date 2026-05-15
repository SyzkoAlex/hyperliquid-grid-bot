import { EMOJI } from '../constants/emoji';

export class SettingsMessage {
    readonly text: string;
    readonly toggleLabel: string;

    private constructor(tradeNotificationsEnabled: boolean) {
        const state = tradeNotificationsEnabled ? 'ON' : 'OFF';
        const bell = tradeNotificationsEnabled ? EMOJI.BELL_ON : EMOJI.BELL_OFF;
        const lines = [
            `<b>${EMOJI.SETTINGS} Settings</b>`,
            '',
            `<b>Trade notifications:</b> ${state}`,
            '',
            'Toggle below to enable or disable trade notifications.',
        ];
        this.text = lines.join('\n');
        this.toggleLabel = `${bell} Trade notifications: ${state}`;
    }

    static create(tradeNotificationsEnabled: boolean): SettingsMessage {
        return new SettingsMessage(tradeNotificationsEnabled);
    }
}
