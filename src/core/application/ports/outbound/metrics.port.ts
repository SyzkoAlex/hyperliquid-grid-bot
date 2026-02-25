export const METRICS_PORT = Symbol('METRICS_PORT');

export interface MetricsPort {
    // Counters
    recordOrderPlaced(symbol: string, side: string): void;
    recordOrderFilled(symbol: string, side: string): void;
    recordOrderCancelled(symbol: string): void;
    recordGridStarted(symbol: string, mode: string): void;
    recordGridStopped(symbol: string, reason: string): void;
    recordLiquidationAlert(level: string): void;

    // Gauges
    setActiveGrids(count: number): void;
    setActiveOrders(symbol: string, count: number): void;
    setPositionSize(symbol: string, size: number): void;
    setTotalPnL(symbol: string, pnl: number): void;
    setLiquidationDistance(symbol: string, percent: number): void;
    setMarginRatio(ratio: number): void;

    // Histograms
    observeOrderExecutionTime(durationSeconds: number): void;
    observeGridRebalanceTime(durationSeconds: number): void;
}
