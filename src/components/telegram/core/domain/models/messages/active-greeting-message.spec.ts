import { describe, it, expect } from 'vitest';
import { ActiveGreetingMessage } from './active-greeting-message';

describe('ActiveGreetingMessage', () => {
    it('includes @username when provided', () => {
        expect(ActiveGreetingMessage.create({ username: 'bob' }).text).toBe('Welcome back, @bob!');
    });

    it('falls back when username missing', () => {
        expect(ActiveGreetingMessage.create({}).text).toBe('Welcome back!');
    });
});
