import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';
import { Decimal } from '@domain/models/primitives/decimal';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { SpotSwapExecutorService } from '@components/trading/core/application/services/spot-swap-executor/spot-swap-executor.service';
import { Config } from '@/config/config.schema';
import { ExecuteSpotSwapParams } from './types/execute-spot-swap-params';
import { ExecuteSpotSwapResult } from './types/execute-spot-swap-result';

@Injectable()
export class ExecuteSpotSwapUseCase {
    private readonly minOrderNotional: number;

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        private readonly executor: SpotSwapExecutorService,
        configService: ConfigService<Config, true>,
    ) {
        this.minOrderNotional = configService.get('hyperliquid', { infer: true }).minOrderNotional;
    }

    async execute(params: ExecuteSpotSwapParams): Promise<ExecuteSpotSwapResult> {
        if (params.amountUsdc < this.minOrderNotional) {
            return {
                success: false,
                filledBase: 0,
                notionalUsdc: 0,
                errorMessage: `Swap amount $${params.amountUsdc.toFixed(2)} is below the minimum order notional of $${this.minOrderNotional}.`,
            };
        }

        const symbol = TradingSymbol.create(params.symbol);
        const l2Touch = await this.exchange.getL2Touch(symbol);

        // Convert USDC notional to executor amount:
        // - UsdcToBase: executor expects the USDC to spend
        // - BaseToUsdc: executor expects the BASE amount to sell, sized from
        //   bestBid (the executable price for a market sell)
        const amount =
            params.side === SwapSide.UsdcToBase
                ? Decimal.from(params.amountUsdc)
                : Decimal.from(params.amountUsdc / l2Touch.bestBid.toNumber());

        const result = await this.executor.execute({
            symbol: params.symbol,
            side: params.side,
            amount,
            l2Touch,
            accountAddress: params.accountAddress,
        });

        return {
            success: result.success,
            filledBase: result.filledBase,
            notionalUsdc: result.notionalUsdc,
            errorMessage: result.errorMessage,
        };
    }
}
