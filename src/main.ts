import { AppTypes } from './infra/config/app.types';
import { loadConfiguration } from './infra/config/configuration';
import { logger } from './infra/logger/logger';
import { bootstrapTradingBotApp } from './apps/trading-bot/bootstrap-trading-bot';
import { bootstrapTelegramCtrlApp } from './apps/telegram-ctrl/bootstrap-telegram-ctrl';
import { bootstrapAllInOneApp } from './apps/all-in-one/bootstrap-all-in-one';
import manifest from '../package.json';

function bootstrap(): Promise<void> {
    registerErrorHandlers();

    const config = loadConfiguration();
    const type = config.app.type as AppTypes;
    const version = manifest.version;

    logger.info({ app: config.app.name }, `Starting ${type}. Version ${version}`);

    switch (type) {
        case AppTypes.TRADING_BOT:
            return bootstrapTradingBotApp();
        case AppTypes.TELEGRAM_CTRL:
            return bootstrapTelegramCtrlApp();
        case AppTypes.ALL_IN_ONE:
            return bootstrapAllInOneApp();
        default:
            throw new Error(
                `Unknown application type "${type}". Available types: ${Object.values(AppTypes)}`,
            );
    }
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

    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down gracefully');
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        logger.info('SIGINT received, shutting down gracefully');
        process.exit(0);
    });
}
