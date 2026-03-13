import { describe, it, expect } from 'vitest';
import { AdvancedLevelsTexts, AdvancedLevelsConfirmationMessage } from './advanced-levels.messages';

describe('AdvancedLevelsTexts', () => {
    it('has non-empty PROMPT', () => {
        expect(AdvancedLevelsTexts.PROMPT).toBeTruthy();
    });

    it('mentions min and max levels range', () => {
        expect(AdvancedLevelsTexts.PROMPT).toContain('3');
        expect(AdvancedLevelsTexts.PROMPT).toContain('100');
    });
});

describe('AdvancedLevelsConfirmationMessage', () => {
    it('contains the level count', () => {
        const result = AdvancedLevelsConfirmationMessage.create(20);
        expect(result.text).toContain('20');
    });

    it('indicates levels were set', () => {
        const result = AdvancedLevelsConfirmationMessage.create(10);
        expect(result.text).toContain('Grid levels set');
    });
});
