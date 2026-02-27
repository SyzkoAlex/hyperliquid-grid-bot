import { Injectable } from '@nestjs/common';

interface PendingMessage {
    chatId: number;
    messageId: number;
}

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
