import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { logger } from './logger';

/**
 * Logger Service
 * NestJS-compatible logger service wrapping pino
 */
@Injectable()
export class LoggerService implements NestLoggerService {
    log(message: string, context?: string) {
        if (context) {
            logger.child({ context }).info(message);
        } else {
            logger.info(message);
        }
    }

    error(message: string, trace?: string, context?: string) {
        if (context) {
            logger.child({ context }).error({ trace }, message);
        } else {
            logger.error({ trace }, message);
        }
    }

    warn(message: string, context?: string) {
        if (context) {
            logger.child({ context }).warn(message);
        } else {
            logger.warn(message);
        }
    }

    debug(message: string, context?: string) {
        if (context) {
            logger.child({ context }).debug(message);
        } else {
            logger.debug(message);
        }
    }

    verbose(message: string, context?: string) {
        if (context) {
            logger.child({ context }).trace(message);
        } else {
            logger.trace(message);
        }
    }

    context(contextName: string) {
        return logger.child({ context: contextName });
    }
}
