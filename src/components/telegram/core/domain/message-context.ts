import { InlineButton } from './inline-button';

export interface MessageContext {
    readonly chatId: number | undefined;
    reply(text: string, keyboard?: InlineButton[][]): Promise<void>;
    editMessage(text: string, keyboard?: InlineButton[][]): Promise<void>;
    answerCallback(): Promise<void>;
}
