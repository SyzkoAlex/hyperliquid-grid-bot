export interface TriggerStopLossParams {
    gridId: string;
    symbol: string;
    stopLossPrice: number;
    /** Real mid price at the moment the stop-loss trigger was confirmed. */
    currentMid: number;
    accountAddress: string;
}
