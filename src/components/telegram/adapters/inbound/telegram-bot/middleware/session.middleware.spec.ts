import { describe, expect, it, vi } from 'vitest';
import { createSessionMiddleware } from './session.middleware';
import { CacheSessionStore } from '../cache-session-store';
import { session } from 'telegraf';

vi.mock('telegraf', async (importOriginal) => {
    const actual = await importOriginal<typeof import('telegraf')>();
    return { ...actual, session: vi.fn().mockReturnValue(vi.fn()) };
});

describe('createSessionMiddleware', () => {
    const store = {} as CacheSessionStore;

    it('returns the middleware produced by telegraf session()', () => {
        const mockMiddleware = vi.fn();
        vi.mocked(session).mockReturnValue(mockMiddleware as never);

        const result = createSessionMiddleware(store);
        expect(result).toBe(mockMiddleware);
    });

    it('passes the store to telegraf session()', () => {
        createSessionMiddleware(store);
        expect(session).toHaveBeenCalledWith(expect.objectContaining({ store }));
    });

    it('defaultSession returns an empty object', () => {
        createSessionMiddleware(store);
        const { defaultSession } = vi.mocked(session).mock.calls.at(-1)![0] as {
            defaultSession: () => object;
        };
        expect(defaultSession()).toEqual({});
    });
});
