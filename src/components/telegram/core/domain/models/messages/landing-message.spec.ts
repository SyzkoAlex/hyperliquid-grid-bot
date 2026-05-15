import { describe, it, expect } from 'vitest';
import { LandingMessage } from './landing-message';

describe('LandingMessage', () => {
    it('mentions grid strategies', () => {
        expect(LandingMessage.create().text).toContain('grid strategies');
    });

    it('greets the user with the welcome wave copy', () => {
        expect(LandingMessage.create().text).toContain(
            'Hey 👋 This bot helps you run grid strategies on Hyperliquid Spot',
        );
    });

    it('does not include the bot-name heading', () => {
        expect(LandingMessage.create().text).not.toContain('Hyperliquid Grid Bot');
    });
});
