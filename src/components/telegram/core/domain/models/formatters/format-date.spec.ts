import { describe, it, expect } from 'vitest';
import { formatDate } from './format-date';

const FIXED_TS = Date.UTC(2025, 4, 9, 14, 32); // May 9 2025 14:32 UTC

describe('formatDate', () => {
    it('returns UTC-formatted string when no timezone arg is given', () => {
        const result = formatDate(FIXED_TS);
        expect(result).toBe('09 May 14:32');
    });

    it('returns UTC-formatted string when UTC is given explicitly', () => {
        const result = formatDate(FIXED_TS, 'UTC');
        expect(result).toBe('09 May 14:32');
    });

    it('returns different output for Asia/Tokyo (UTC+9)', () => {
        const result = formatDate(FIXED_TS, 'Asia/Tokyo');
        expect(result).toBe('09 May 23:32');
    });

    it('output matches format DD Mon HH:mm', () => {
        const result = formatDate(FIXED_TS);
        expect(result).toMatch(/^\d{2} [A-Z][a-z]{2} \d{2}:\d{2}$/);
    });
});
