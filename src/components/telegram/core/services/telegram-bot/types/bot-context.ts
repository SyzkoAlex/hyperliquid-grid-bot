import { Context, Scenes } from 'telegraf';
import { SessionData } from './session-data';

export interface BotContext extends Context {
    session: SessionData;
    scene: Scenes.SceneContextScene<BotContext, Scenes.SceneSessionData>;
}
