import { describe, it, expect } from 'vitest';
import { AdvancedUpperPromptMessage } from './advanced-upper.messages';

describe('AdvancedUpperPromptMessage', () => {
    it('shows basic prompt without params', () => {
        const result = AdvancedUpperPromptMessage.create();
        expect(result.text).toContain('Enter upper price');
    });

    it('shows current price when symbol and price provided', () => {
        const result = AdvancedUpperPromptMessage.create('BTC', 95000);
        expect(result.text).toContain('BTC');
        expect(result.text).toContain('95000');
    });

    it('shows warning when symbol provided but no price', () => {
        const result = AdvancedUpperPromptMessage.create('BTC');
        expect(result.text).toContain('Could not fetch current price');
    });
});
