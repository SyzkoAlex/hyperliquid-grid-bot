import { describe, it, expect } from 'vitest';
import { LandingMessage } from './landing-message';

describe('LandingMessage', () => {
    it('contains bot name', () => {
        expect(LandingMessage.create().text).toContain('Hyperliquid Grid Bot');
    });

    it('mentions automated grid trading', () => {
        expect(LandingMessage.create().text).toContain('grid trading');
    });

    it('contains a not-affiliated disclaimer', () => {
        expect(LandingMessage.create().text).toContain('not affiliated');
    });
});
