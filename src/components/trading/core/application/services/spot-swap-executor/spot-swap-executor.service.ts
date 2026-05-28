import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/infra/logger/logger';
import { Config } from '@/config/config.schema';
import { OrderStatus } from '@domain/models/order/order-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { SpotSwapParams } from './types/spot-swap-params';
import { SpotSwapResult } from './types/spot-swap-result';

function formatCapPct(cap: number): string {
    return `${cap * 100}%`;
}

@Injectable()
export class SpotSwapExecutorService {
    private readonly logger = logger.child({ context: SpotSwapExecutorService.name });
    private readonly initialSlippageCap: number;
    private readonly retrySlippageCap: number;

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        config: ConfigService<Config, true>,
    ) {
        const { initialSlippageCapPct, retrySlippageCapPct } = config.get('swap', { infer: true });
        this.initialSlippageCap = initialSlippageCapPct;
        this.retrySlippageCap = retrySlippageCapPct;
    }

    async execute(params: SpotSwapParams): Promise<SpotSwapResult> {
        const symbol = TradingSymbol.create(params.symbol);
        const midPrice = Price.from(params.currentMid);

        // Single CLOID for both IOC attempts — Hyperliquid deduplicates by CLOID,
        // so a lost response on attempt 1 won't result in a second live order on attempt 2.
        const cloid = uuidv4();

        // Two-attempt IOC price escalation strategy:
        //   Attempt 1 — tight slippage cap (e.g. 0.5%). The limit price is close to mid,
        //               so we only fill if the market is already there. Cheap when it works.
        //   Attempt 2 — wider slippage cap (e.g. 1.5%). If the spread or a brief move
        //               caused the first attempt to miss, we accept a slightly worse price.
        //
        // Both attempts share the same CLOID. Hyperliquid deduplicates orders by CLOID,
        // so if attempt 1 actually filled but the response was lost in transit, attempt 2
        // will be rejected as a duplicate instead of opening a second position.
        const slippageCaps = [this.initialSlippageCap, this.retrySlippageCap];
        for (const cap of slippageCaps) {
            const result = await this.attemptIocSwap(params, symbol, midPrice, cap, cloid);
            if (result !== null) return result;
        }

        const diagnostics = {
            mid: params.currentMid,
            side: params.side,
            amount: params.amount.toNumber(),
            symbol: params.symbol,
        };
        this.logger.warn({ ...diagnostics }, 'IOC swap failed — aborting, notifying user');

        const errorMessage =
            `Order didn't fill at the best available price after 2 attempts. ` +
            `Manual action may be required.`;

        return {
            success: false,
            filledBase: 0,
            notionalUsdc: 0,
            errorMessage,
        };
    }

    private async attemptIocSwap(
        params: SpotSwapParams,
        symbol: TradingSymbol,
        midPrice: Price,
        slippageCap: number,
        orderId: string,
    ): Promise<SpotSwapResult | null> {
        if (params.side === SwapSide.UsdcToBase) {
            return this.attemptIocBuy(params, symbol, midPrice, slippageCap, orderId);
        }
        return this.attemptIocSell(params, symbol, midPrice, slippageCap, orderId);
    }

    private async attemptIocBuy(
        params: SpotSwapParams,
        symbol: TradingSymbol,
        midPrice: Price,
        slippageCap: number,
        orderId: string,
    ): Promise<SpotSwapResult | null> {
        // Buy: pay up to mid * (1 + slippageCap); baseAmount = spentUsdc / limitPrice
        const limitPrice = Price.from(midPrice.toNumber() * (1 + slippageCap));
        const baseAmount = Decimal.from(params.amount.toNumber() / limitPrice.toNumber());
        const capLabel = formatCapPct(slippageCap);

        this.logger.info(
            { limitPrice: limitPrice.toNumber(), cap: capLabel },
            `Attempting IOC market buy (${capLabel})`,
        );

        const result = await this.exchange.placeSpotMarketBuy({
            symbol,
            amount: baseAmount,
            limitPrice,
            orderId,
            accountAddress: params.accountAddress,
        });

        if (result.status !== OrderStatus.Filled) {
            return null;
        }

        const notionalUsdc = baseAmount.toNumber() * limitPrice.toNumber();
        this.logger.info({ notionalUsdc }, `IOC buy filled (${capLabel})`);

        return {
            success: true,
            filledBase: baseAmount.toNumber(),
            notionalUsdc,
        };
    }

    private async attemptIocSell(
        params: SpotSwapParams,
        symbol: TradingSymbol,
        midPrice: Price,
        slippageCap: number,
        orderId: string,
    ): Promise<SpotSwapResult | null> {
        // Sell: accept down to mid * (1 - slippageCap)
        const limitPrice = Price.from(midPrice.toNumber() * (1 - slippageCap));
        const capLabel = formatCapPct(slippageCap);

        this.logger.info(
            { limitPrice: limitPrice.toNumber(), cap: capLabel },
            `Attempting IOC market sell (${capLabel})`,
        );

        const result = await this.exchange.placeSpotMarketSell({
            symbol,
            amount: params.amount,
            limitPrice,
            orderId,
            accountAddress: params.accountAddress,
        });

        if (result.status !== OrderStatus.Filled) {
            return null;
        }

        const notionalUsdc = params.amount.toNumber() * limitPrice.toNumber();
        this.logger.info({ notionalUsdc }, `IOC sell filled (${capLabel})`);

        return {
            success: true,
            filledBase: params.amount.toNumber(),
            notionalUsdc,
        };
    }
}
