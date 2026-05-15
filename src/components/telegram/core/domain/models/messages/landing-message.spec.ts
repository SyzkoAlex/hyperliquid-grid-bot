import { describe, it, expect } from 'vitest';
import { LandingMessage } from './landing-message';

describe('LandingMessage', () => {
    it('contains bot name', () => {
        expect(LandingMessage.create().text).toContain('Hyperliquid Grid Bot');
    });

    it('mentions grid strategies', () => {
        expect(LandingMessage.create().text).toContain('grid strategies');
    });

    it('mentions grid of limit orders', () => {
        expect(LandingMessage.create().text).toContain('grid of limit orders');
    });

    it('contains a not-affiliated disclaimer', () => {
        expect(LandingMessage.create().text).toContain('not affiliated');
    });

    it('mentions agent wallet', () => {
        expect(LandingMessage.create().text).toContain('agent wallet');
    });

    it('mentions withdrawals are not possible', () => {
        expect(LandingMessage.create().text).toContain('withdrawals are not possible');
    });
});
