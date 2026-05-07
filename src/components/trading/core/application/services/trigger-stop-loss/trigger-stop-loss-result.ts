export interface TriggerStopLossResult {
    success: boolean;
    soldBaseAmount: number;
    receivedUSDC: number;
    errorMessage?: string;
}
