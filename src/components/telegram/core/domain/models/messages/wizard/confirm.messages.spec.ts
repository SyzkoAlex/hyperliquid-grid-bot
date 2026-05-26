import { describe, it, expect } from 'vitest';
import { GridCreatingMessage } from './confirm.messages';

describe('GridCreatingMessage', () => {
    it('indicates grid is being created', () => {
        const result = GridCreatingMessage.create({ summary: '' });
        expect(result.text).toContain('Creating grid');
    });

    it('includes notification text', () => {
        const result = GridCreatingMessage.create({ summary: '' });
        expect(result.text).toContain("We'll notify you");
    });

    it('includes the summary when provided', () => {
        const summary = '✓ <b>Pair</b> · BTC\n✓ <b>Levels</b> · 10';
        const result = GridCreatingMessage.create({ summary });
        expect(result.text).toContain('BTC');
        expect(result.text).toContain('10');
    });

    it('renders cleanly when summary is empty', () => {
        const result = GridCreatingMessage.create({ summary: '' });
        expect(result.text).not.toContain('undefined');
        expect(result.text).toContain('Creating grid');
        expect(result.text).toContain("We'll notify you");
    });
});
