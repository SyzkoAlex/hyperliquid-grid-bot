import { createWorker } from '../common/create-worker';
import { BotAppModule } from './bot-app.module';
import { logger } from '../../infra/logger/logger';

export async function bootstrapBotApp(): Promise<void> {
    const app = await createWorker(BotAppModule);

    await app.init();

    logger.info(
        {
            appName: 'Hyperliquid Grid Bot',
            env: process.env.NODE_ENV,
        },
        'Grid Bot started',
    );
}
