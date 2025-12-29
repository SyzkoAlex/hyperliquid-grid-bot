import { AppTypes } from './infra/config/app.types';
import { loadConfiguration } from './infra/config/configuration';
import { logger } from './infra/logger/logger';
import { bootstrapBotApp } from './apps/bot/bootstrap-bot';
import manifest from '../package.json';

function bootstrap(): Promise<void> {
    registerErrorHandlers();

    const config = loadConfiguration();
    const type = config.app.type as AppTypes;
    const version = manifest.version;

    logger.info({ app: config.app.name }, `Starting ${type}. Version ${version}`);

    switch (type) {
        case AppTypes.BOT:
            return bootstrapBotApp();
        default:
            throw new Error(
                `Unknown application type "${type}". Available types: ${Object.values(AppTypes)}`,
            );
    }
}

bootstrap().catch((error) => {
    logger.fatal({ error }, 'Failed to start application');
    process.exit(1);
});

function registerErrorHandlers(): void {
    process.on('unhandledRejection', (err: Error) => {
        logger.fatal(
            {
                err,
            },
            'unhandledRejection',
        );
        process.exit(1);
    });

    process.on('uncaughtException', (err: Error) => {
        logger.fatal(
            {
                err,
            },
            'uncaughtException',
        );
        process.exit(1);
    });

    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down gracefully');
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        logger.info('SIGINT received, shutting down gracefully');
        process.exit(0);
    });
}
