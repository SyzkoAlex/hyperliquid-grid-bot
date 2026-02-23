import pino from 'pino';
import type { Logger } from './logger.port';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';
const pretty = process.env.LOG_PRETTY === 'true';

export const logger: Logger = pino({
    level: logLevel,
    transport:
        !isProduction && pretty
            ? {
                  target: 'pino-pretty',
                  options: {
                      colorize: true,
                      translateTime: 'SYS:standard',
                      ignore: 'pid,hostname',
                  },
              }
            : undefined,
    formatters: {
        level: (label) => {
            return { level: label };
        },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

export const createContextLogger = (context: string): Logger => {
    return logger.child({ context });
};
