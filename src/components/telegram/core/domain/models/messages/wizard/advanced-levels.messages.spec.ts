import { describe, it, expect } from 'vitest';
import { AdvancedLevelsTexts } from './advanced-levels.messages';

describe('AdvancedLevelsTexts', () => {
    it('has non-empty PROMPT', () => {
        expect(AdvancedLevelsTexts.PROMPT).toBeTruthy();
    });

    it('mentions min and max levels range', () => {
        expect(AdvancedLevelsTexts.PROMPT).toContain('3');
        expect(AdvancedLevelsTexts.PROMPT).toContain('100');
    });
});
