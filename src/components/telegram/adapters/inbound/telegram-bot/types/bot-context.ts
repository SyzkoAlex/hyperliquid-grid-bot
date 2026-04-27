import { Context, Scenes } from 'telegraf';
import { SessionData } from './session-data';
import { UserDto } from '@components/users/api/dto/user.dto';

export interface BotContext extends Context {
    session: SessionData;
    scene: Scenes.SceneContextScene<BotContext, Scenes.SceneSessionData>;
    match?: RegExpExecArray;
    user?: UserDto; // populated by auth middleware for registered users
}
