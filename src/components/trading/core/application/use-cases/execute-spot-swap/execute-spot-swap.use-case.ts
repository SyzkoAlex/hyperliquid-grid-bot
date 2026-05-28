import { Inject, Injectable } from '@nestjs/common';
import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';
import { Decimal } from '@domain/models/primitives/decimal';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { SpotSwapExecutorService } from '@components/trading/core/application/services/spot-swap-executor/spot-swap-executor.service';
import { ExecuteSpotSwapParams } from './types/execute-spot-swap-params';
import { ExecuteSpotSwapResult } from './types/execute-spot-swap-result';

@Injectable()
export class ExecuteSpotSwapUseCase {
    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        private readonly executor: SpotSwapExecutorService,
    ) {}

    async execute(
        params: ExecuteSpotSwapParams,
        minOrderNotional: number,
    ): Promise<ExecuteSpotSwapResult> {
        if (params.amountUsdc < minOrderNotional) {
            return {
                success: false,
                filledBase: 0,
                notionalUsdc: 0,
                errorMessage: `Swap amount $${params.amountUsdc.toFixed(2)} is below the minimum order notional of $${minOrderNotional}.`,
            };
        }

        const symbol = TradingSymbol.create(params.symbol);
        const currentMid = await this.exchange.getCurrentPrice(symbol);
        const mid = currentMid.toNumber();

        // Convert USDC notional to executor amount:
        // - UsdcToBase: executor expects the USDC to spend (Decimal)
        // - BaseToUsdc: executor expects the BASE amount to sell (Decimal), derived from USDC notional / mid
        const amount =
            params.side === SwapSide.UsdcToBase
                ? Decimal.from(params.amountUsdc)
                : Decimal.from(params.amountUsdc / mid);

        const result = await this.executor.execute({
            symbol: params.symbol,
            side: params.side,
            amount,
            currentMid: mid,
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
