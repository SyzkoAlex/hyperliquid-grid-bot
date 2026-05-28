export interface ExecuteSpotSwapResult {
    success: boolean;
    filledBase: number;
    notionalUsdc: number;
    errorMessage?: string;
}
