export const METRICS_PORT = Symbol('METRICS_PORT');

export interface MetricsPort {
    observeExchangeApiDuration(method: string, durationSeconds: number): void;
    observeTelegramHandlerDuration(handler: string, durationSeconds: number): void;
}
