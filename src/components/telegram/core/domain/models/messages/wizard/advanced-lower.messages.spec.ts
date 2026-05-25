import { describe, it, expect } from 'vitest';
import { AdvancedLowerPromptMessage } from './advanced-lower.messages';

describe('AdvancedLowerPromptMessage', () => {
    it('shows basic prompt without params', () => {
        const result = AdvancedLowerPromptMessage.create();
        expect(result.text).toContain('Enter lower price');
    });

    it('shows current price when symbol and price are provided', () => {
        const result = AdvancedLowerPromptMessage.create('HYPE', 43.65);
        expect(result.text).toContain('Current HYPE price');
        expect(result.text).toContain('43.65');
    });

    it('shows warning when symbol is set but price is absent', () => {
        const result = AdvancedLowerPromptMessage.create('HYPE');
        expect(result.text).toContain('Could not fetch current price');
    });
});
