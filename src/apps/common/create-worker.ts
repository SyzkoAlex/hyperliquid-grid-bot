import { NestFactory } from '@nestjs/core';
import { logger } from '../../infra/logger/logger';

export async function createWorker(appModule: any) {
    const app = await NestFactory.create(appModule, {
        logger: false, // Disable default logger, use pino
    });

    // Use custom logger
    app.useLogger({
        log: (message: string) => logger.info(message),
        error: (message: string, trace?: string) => logger.error({ trace }, message),
        warn: (message: string) => logger.warn(message),
        debug: (message: string) => logger.debug(message),
        verbose: (message: string) => logger.trace(message),
    });

    // Enable shutdown hooks
    app.enableShutdownHooks();

    return app;
}
