import { MiddlewareFn, session } from 'telegraf';
import { BotContext } from '../types/bot-context';
import { SessionData } from '../types/session-data';
import { CacheSessionStore } from '../cache-session-store';

export function createSessionMiddleware(store: CacheSessionStore): MiddlewareFn<BotContext> {
    return session<SessionData, BotContext>({
        store,
        defaultSession: () => ({}),
    });
}
