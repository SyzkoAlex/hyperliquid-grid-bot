export interface SpotSwapResultDto {
    success: boolean;
    filledBase: number;
    notionalUsdc: number;
    errorMessage?: string;
}
