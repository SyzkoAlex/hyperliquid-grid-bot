import { describe, it, expect } from 'vitest';
import { EmptyGridsMessage } from './empty-grids-message';

describe('EmptyGridsMessage', () => {
    it('greets by username when provided', () => {
        expect(EmptyGridsMessage.create({ username: 'alice' }).text).toContain(
            'Welcome back, @alice!',
        );
    });

    it('falls back to neutral greeting when username missing', () => {
        const text = EmptyGridsMessage.create({}).text;
        expect(text).toContain('Welcome back!');
        expect(text).not.toContain('@');
    });

    it('mentions Create Grid CTA', () => {
        expect(EmptyGridsMessage.create({}).text).toContain('Create Grid');
    });

    it('mentions Quick start step', () => {
        expect(EmptyGridsMessage.create({}).text).toContain('Quick start');
    });
});
