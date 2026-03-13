import pino from 'pino';

export interface Logger {
    trace(obj: object, msg?: string): void;
    trace(msg: string): void;
    debug(obj: object, msg?: string): void;
    debug(msg: string): void;
    info(obj: object, msg?: string): void;
    info(msg: string): void;
    warn(obj: object, msg?: string): void;
    warn(msg: string): void;
    error(obj: object, msg?: string): void;
    error(msg: string): void;
    fatal(obj: object, msg?: string): void;
    fatal(msg: string): void;
    child(bindings: object): Logger;
}

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
    serializers: {
        err: (error: Error & { response?: { data?: unknown } }) => {
            const serialized = pino.stdSerializers.err(error) as Record<string, unknown>;
            if (error.response?.data !== undefined) {
                serialized.responseData = error.response.data;
            }
            return serialized;
        },
    },
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
