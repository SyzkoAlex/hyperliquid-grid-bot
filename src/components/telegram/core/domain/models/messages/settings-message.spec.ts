import { describe, it, expect } from 'vitest';
import { SettingsMessage } from './settings-message';
import { EMOJI } from '../constants/emoji';

describe('SettingsMessage', () => {
    it('renders title with settings emoji', () => {
        const result = SettingsMessage.create(true);
        expect(result.text).toContain(EMOJI.SETTINGS);
        expect(result.text).toContain('Settings');
        expect(result.text).toContain('Toggle below to enable or disable trade notifications.');
    });

    it('shows ON state in text and toggleLabel when enabled', () => {
        const result = SettingsMessage.create(true);
        expect(result.text).toContain('Trade notifications:</b> ON');
        expect(result.toggleLabel).toBe(`${EMOJI.BELL_ON} Trade notifications: ON`);
    });

    it('shows OFF state in text and toggleLabel when disabled', () => {
        const result = SettingsMessage.create(false);
        expect(result.text).toContain('Trade notifications:</b> OFF');
        expect(result.toggleLabel).toBe(`${EMOJI.BELL_OFF} Trade notifications: OFF`);
    });
});
