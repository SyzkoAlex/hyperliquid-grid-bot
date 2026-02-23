import { createWorker } from '../common/create-worker';
import { AllInOneAppModule } from './all-in-one-app.module';
import { logger } from '@/infra/logger/logger';

export async function bootstrapAllInOneApp(): Promise<void> {
    const app = await createWorker(AllInOneAppModule);

    await app.init();

    logger.info(
        {
            appName: 'Hyperliquid All-In-One',
            env: process.env.NODE_ENV,
        },
        'All-In-One App started (Trading Bot + Telegram Control)',
    );
}
