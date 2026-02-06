import { createWorker } from '../common/create-worker';
import { TradingBotAppModule } from './trading-bot-app.module';
import { logger } from '../../infra/logger/logger';

export async function bootstrapTradingBotApp(): Promise<void> {
    const app = await createWorker(TradingBotAppModule);

    await app.init();

    logger.info(
        {
            appName: 'Hyperliquid Trading Bot',
            env: process.env.NODE_ENV,
        },
        'Trading Bot started',
    );
}
