import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { UserBalance, TokenBalance } from '@components/telegram/core/domain/models/user-balance';

@Injectable()
export class GetUserBalanceUseCase {
    private readonly accountAddress: string;

    constructor(
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
        private readonly configService: ConfigService<Config>,
    ) {
        this.accountAddress = configService.get('hyperliquid.accountAddress', { infer: true })!;
    }

    async execute(): Promise<UserBalance> {
        const state = await this.tradingApi.getUserSpotState(this.accountAddress);

        const allTokens = await Promise.all(
            Object.keys(state.spotPositions).map((symbol) =>
                this.fetchTokenBalance(symbol, state.spotPositions[symbol]),
            ),
        );

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
