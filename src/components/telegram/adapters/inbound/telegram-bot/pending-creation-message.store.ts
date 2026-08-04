import { Injectable } from '@nestjs/common';

interface PendingMessage {
    chatId: number;
    messageId: number;
}

/**
 * In-memory bridge between two stages of the grid creation flow:
 *
 * 1. ConfirmStep — on wizard confirmation, sends a "Creating grid…" message to
 *    the chat and stores its chatId + messageId here, keyed by userId.
 *
 * 2. TradingEventsAdapter.notifyCreationResult — when a GridCreatedSuccess/Error
 *    event arrives, retrieves the stored message for that event's userId and edits
 *    it in place instead of sending a new one.
 *
 * Keyed by userId so overlapping grid creations from *different* users don't
 * clobber each other's pending message. consume() clears that user's entry.
 *
 * Does NOT disambiguate two overlapping creations from the *same* user — the
 * second save() still overwrites the first, so the first grid's placeholder is
 * left stale and its result instead arrives via NotifyUserUseCase's fallback
 * (see TradingEventsAdapter.notifyCreationResult). Not persisted — data is lost
 * on restart.
 */
@Injectable()
export class PendingCreationMessageStore {
    private readonly pending = new Map<string, PendingMessage>();

    save(userId: string, chatId: number, messageId: number): void {
        this.pending.set(userId, { chatId, messageId });
    }

    consume(userId: string): PendingMessage | null {
        const message = this.pending.get(userId) ?? null;
        this.pending.delete(userId);
        return message;
    }
}
