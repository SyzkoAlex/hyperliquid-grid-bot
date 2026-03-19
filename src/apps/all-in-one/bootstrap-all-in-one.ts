import { createWorker } from '../common/create-worker';
import { AllInOneAppModule } from './all-in-one-app.module';
import { logger } from '@/infra/logger/logger';
import { loadConfiguration } from '@/config/configuration';

export async function bootstrapAllInOneApp(): Promise<void> {
    const app = await createWorker(AllInOneAppModule);

    const { port, host } = loadConfiguration().app;

    await app.listen(port, host);

    logger.info(
        {
            appName: 'Hyperliquid All-In-One',
            env: process.env.NODE_ENV,
        },
        'All-In-One App started',
    );
}
