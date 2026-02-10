import { MessageContext } from '../domain/message-context';
import { SceneHandler } from '../domain/scene';

export const TELEGRAM_SERVICE = Symbol('TelegramService');

export interface TelegramService {
    onCommand(command: string, handler: (ctx: MessageContext) => Promise<void>): void;
    onAction(action: string, handler: (ctx: MessageContext) => Promise<void>): void;
    registerScene(scene: SceneHandler): void;
    launch(): Promise<void>;
}
