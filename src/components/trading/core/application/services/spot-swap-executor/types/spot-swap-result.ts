export interface SpotSwapResult {
    success: boolean;
    /** Base amount actually filled (positive for both directions). */
    filledBase: number;
    /** USDC notional of the fill, computed as filledBase × limitPrice. */
    notionalUsdc: number;
    errorMessage?: string;
}
