export interface SpotBalanceDto {
    available: number;
    total: number;
    hold: number;
}

export interface UserStateDto {
    usdcBalance: number;
    usdc: SpotBalanceDto;
    spotBalances: Record<string, number>;
    spotPositions: Record<string, SpotBalanceDto>;
}
