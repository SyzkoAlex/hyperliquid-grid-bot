import { describe, it, expect } from 'vitest';
import { WelcomeMessage } from './welcome-message';

describe('WelcomeMessage', () => {
    it('contains bot name', () => {
        const result = WelcomeMessage.create();
        expect(result.text).toContain('Hyperliquid Grid Bot');
    });

    it('mentions grid trading', () => {
        const result = WelcomeMessage.create();
        expect(result.text).toContain('grid trading');
    });
});
