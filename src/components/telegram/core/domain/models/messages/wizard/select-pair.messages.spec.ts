import { describe, it, expect } from 'vitest';
import { SelectPairTexts, SelectPairConfirmationMessage } from './select-pair.messages';

describe('SelectPairTexts', () => {
    it('has non-empty PROMPT', () => {
        expect(SelectPairTexts.PROMPT).toBeTruthy();
    });

    it('has non-empty OTHER_TOKEN_PROMPT', () => {
        expect(SelectPairTexts.OTHER_TOKEN_PROMPT).toBeTruthy();
    });
});

describe('SelectPairConfirmationMessage', () => {
    it('contains the selected symbol', () => {
        const result = SelectPairConfirmationMessage.create('BTC');
        expect(result.text).toContain('BTC');
    });

    it('shows USDC pair format', () => {
        const result = SelectPairConfirmationMessage.create('ETH');
        expect(result.text).toContain('ETH/USDC');
    });
});
