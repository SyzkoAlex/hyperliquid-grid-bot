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
        const symbols = Object.keys(state.spotPositions);

        const tokens: TokenBalance[] = await Promise.all(
            symbols.map(async (symbol) => {
                const pos = state.spotPositions[symbol];
                const price = await this.tradingApi.getCurrentPrice(symbol);
                const valueUsdc = pos.total * price;
                return {
                    symbol,
                    available: pos.available,
                    inOrders: pos.hold,
                    total: pos.total,
                    price,
                    valueUsdc,
                };
            }),
        );

        const nonZeroTokens = tokens.filter((t) => t.total > 0);
        const tokensValue = nonZeroTokens.reduce((sum, t) => sum + t.valueUsdc, 0);
        const totalValueUsdc = state.usdc.total + tokensValue;

        return {
            usdc: {
                available: state.usdc.available,
                inOrders: state.usdc.hold,
                total: state.usdc.total,
            },
            tokens: nonZeroTokens,
            totalValueUsdc,
        };
    }
}
