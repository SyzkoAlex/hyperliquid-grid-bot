import { describe, it, expect, beforeEach } from 'vitest';
import { PendingCreationMessageStore } from './pending-creation-message.store';

describe('PendingCreationMessageStore', () => {
    let store: PendingCreationMessageStore;

    beforeEach(() => {
        store = new PendingCreationMessageStore();
    });

    it('returns null when nothing was saved for a user', () => {
        expect(store.consume('user-1')).toBeNull();
    });

    it('returns the saved message for the matching user and clears it', () => {
        store.save('user-1', 111, 222);

        expect(store.consume('user-1')).toEqual({ chatId: 111, messageId: 222 });
        expect(store.consume('user-1')).toBeNull();
    });

    it('keeps entries for different users independent — one user consuming does not affect another', () => {
        store.save('user-1', 111, 222);
        store.save('user-2', 333, 444);

        expect(store.consume('user-1')).toEqual({ chatId: 111, messageId: 222 });
        expect(store.consume('user-2')).toEqual({ chatId: 333, messageId: 444 });
    });

    it('overwrites only the entry for the same user when saved twice', () => {
        store.save('user-1', 111, 222);
        store.save('user-2', 333, 444);
        store.save('user-1', 555, 666);

        expect(store.consume('user-1')).toEqual({ chatId: 555, messageId: 666 });
        expect(store.consume('user-2')).toEqual({ chatId: 333, messageId: 444 });
    });
});
