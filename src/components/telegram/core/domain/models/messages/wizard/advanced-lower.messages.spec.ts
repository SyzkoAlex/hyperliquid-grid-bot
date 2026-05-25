import { describe, it, expect } from 'vitest';
import { AdvancedLowerPromptMessage } from './advanced-lower.messages';

describe('AdvancedLowerPromptMessage', () => {
    it('shows basic prompt without upper price', () => {
        const result = AdvancedLowerPromptMessage.create();
        expect(result.text).toContain('Enter lower price');
    });

    it('shows the upper price when provided', () => {
        const result = AdvancedLowerPromptMessage.create(100000);
        expect(result.text).toContain('100000');
        expect(result.text).toContain('Upper price');
    });
});
