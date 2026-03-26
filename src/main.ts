import { loadConfiguration } from '@/config/configuration';
import { logger } from '@/infra/logger/logger';
import { bootstrapAllInOneApp } from './apps/all-in-one/bootstrap-all-in-one';
import manifest from '../package.json';

function bootstrap(): Promise<void> {
    registerErrorHandlers();

    const config = loadConfiguration();
    const version = manifest.version;

    logger.info({ app: config.app.name }, `Starting application. Version ${version}`);

    return bootstrapAllInOneApp();
}

bootstrap().catch((error) => {
    logger.fatal(
        { error, message: error.message, stack: error.stack },
        'Failed to start application',
    );
    console.error('Bootstrap error:', error);
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
}
