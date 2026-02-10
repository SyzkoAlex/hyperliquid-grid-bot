import { InlineButton } from './inline-button';
import { Scenes } from 'telegraf';

export interface MessageContext {
    readonly chatId: number | undefined;
    readonly scene: Scenes.SceneContextScene<any>;
    reply(text: string, keyboard?: InlineButton[][]): Promise<void>;
    editMessage(text: string, keyboard?: InlineButton[][]): Promise<void>;
    answerCallback(): Promise<void>;
}
