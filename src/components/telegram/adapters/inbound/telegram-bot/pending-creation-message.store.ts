import { Injectable } from '@nestjs/common';

interface PendingMessage {
    chatId: number;
    messageId: number;
}

/**
 * In-memory bridge between two stages of the grid creation flow:
 *
 * 1. ConfirmStep — on wizard confirmation, sends a "Creating grid…" message to
 *    the chat and stores its chatId + messageId here.
 *
 * 2. TelegramBotService.sendCreationResultNotification — when a GridCreatedSuccess/Error
 *    event arrives, retrieves the stored message and edits it in place instead of
 *    sending a new one.
 *
 * Holds at most one pending message; consume() clears the state.
 * Not persisted — data is lost on restart.
 */
@Injectable()
export class PendingCreationMessageStore {
    private pending: PendingMessage | null = null;

    save(chatId: number, messageId: number): void {
        this.pending = { chatId, messageId };
    }

    consume(): PendingMessage | null {
        const message = this.pending;
        this.pending = null;
        return message;
    }
}
