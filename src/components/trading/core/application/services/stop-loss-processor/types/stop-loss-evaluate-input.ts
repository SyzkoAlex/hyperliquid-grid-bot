export interface StopLossEvaluateInput {
    gridId: string;
    stopLossEnabled: boolean;
    stopLossPrice: number | null;
    currentPrice: number;
    now: number;
}
