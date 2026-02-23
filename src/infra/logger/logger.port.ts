export const LOGGER_PORT = Symbol('LOGGER_PORT');

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
