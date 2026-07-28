import { describe, it, expect } from 'vitest';
import { AdvancedOrdersTexts } from './advanced-orders.messages';

describe('AdvancedOrdersTexts', () => {
    it('has non-empty PROMPT', () => {
        expect(AdvancedOrdersTexts.PROMPT).toBeTruthy();
    });

    it('mentions min and max orders range', () => {
        expect(AdvancedOrdersTexts.PROMPT).toContain('5');
        expect(AdvancedOrdersTexts.PROMPT).toContain('100');
    });
});
