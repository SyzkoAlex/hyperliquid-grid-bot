import { describe, it, expect } from 'vitest';
import { HelpMessage } from './help-message';

describe('HelpMessage', () => {
    it('contains bot name', () => {
        expect(HelpMessage.create().text).toContain('Hyperliquid Grid Bot');
    });

    it('contains How it works section', () => {
        expect(HelpMessage.create().text).toContain('How it works');
    });

    it('contains Quick Start section', () => {
        expect(HelpMessage.create().text).toContain('Quick Start');
    });

    it('contains Risk Warning section', () => {
        expect(HelpMessage.create().text).toContain('Risk Warning');
    });

    it('contains Support section with link', () => {
        const { text } = HelpMessage.create();
        expect(text).toContain('Support');
        expect(text).toContain('https://github.com/');
    });
});
