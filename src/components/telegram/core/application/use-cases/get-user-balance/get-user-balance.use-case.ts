import { Inject, Injectable } from '@nestjs/common';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { TokenBalance, UserBalance } from '@components/telegram/core/domain/models/user-balance';

@Injectable()
export class GetUserBalanceUseCase {
    constructor(@Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort) {}

    async execute(accountAddress: string): Promise<UserBalance> {
        const state = await this.tradingApi.getUserSpotState(accountAddress);

        const allTokens = await this.fetchAllTokenBalances(state.spotPositions);
        const tokens = allTokens.filter((t) => t.total > 0);
        const totalValueUsdc = state.usdc.total + tokens.reduce((sum, t) => sum + t.valueUsdc, 0);

        return {
            usdc: {
                available: state.usdc.available,
                inOrders: state.usdc.hold,
                total: state.usdc.total,
            },
            tokens,
            totalValueUsdc,
        };
    }

    private async fetchAllTokenBalances(
        spotPositions: Record<string, { available: number; hold: number; total: number }>,
    ): Promise<TokenBalance[]> {
        return Promise.all(
            Object.keys(spotPositions).map((symbol) =>
                this.fetchTokenBalance(symbol, spotPositions[symbol]),
            ),
        );
    }

    private async fetchTokenBalance(
        symbol: string,
        pos: { available: number; hold: number; total: number },
    ): Promise<TokenBalance> {
        const price = await this.tradingApi.getCurrentPrice(symbol);
        return {
            symbol,
            available: pos.available,
            inOrders: pos.hold,
            total: pos.total,
            price,
            valueUsdc: pos.total * price,
        };
    }
}
