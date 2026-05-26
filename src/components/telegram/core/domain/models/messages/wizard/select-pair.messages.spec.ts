import { describe, it, expect } from 'vitest';
import { SelectPairTexts } from './select-pair.messages';

describe('SelectPairTexts', () => {
    it('has non-empty PROMPT', () => {
        expect(SelectPairTexts.PROMPT).toBeTruthy();
    });

    it('has non-empty OTHER_TOKEN_PROMPT', () => {
        expect(SelectPairTexts.OTHER_TOKEN_PROMPT).toBeTruthy();
    });
});
