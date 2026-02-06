import { createWorker } from '../common/create-worker';
import { TelegramCtrlAppModule } from './telegram-ctrl-app.module';
import { logger } from '../../infra/logger/logger';

export async function bootstrapTelegramCtrlApp(): Promise<void> {
    const app = await createWorker(TelegramCtrlAppModule);

    await app.init();

    logger.info(
        {
            appName: 'Hyperliquid Telegram Control',
            env: process.env.NODE_ENV,
        },
        'Telegram Control started',
    );
}
