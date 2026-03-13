import { Scenes } from 'telegraf';
import { BotContext } from '../types/bot-context';

export interface SceneHandler {
    readonly id: string;
    createScene(): Scenes.BaseScene<BotContext>;
}
