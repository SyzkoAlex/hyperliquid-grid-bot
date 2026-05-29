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

function formatBufferPct(buffer: number): string {
    return `${buffer * 100}%`;
}

@Injectable()
export class SpotSwapExecutorService {
    private readonly logger = logger.child({ context: SpotSwapExecutorService.name });
    private readonly initialL2Buffer: number;
    private readonly retryL2Buffer: number;

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        config: ConfigService<Config, true>,
    ) {
        const { initialL2BufferPct, retryL2BufferPct } = config.get('swap', { infer: true });
        this.initialL2Buffer = initialL2BufferPct;
        this.retryL2Buffer = retryL2BufferPct;
    }

    async execute(params: SpotSwapParams): Promise<SpotSwapResult> {
        const symbol = TradingSymbol.create(params.symbol);

        // Single CLOID for both IOC attempts — Hyperliquid deduplicates by CLOID,
        // so a lost response on attempt 1 won't result in a second live order on attempt 2.
        const cloid = uuidv4();

        // Two-attempt L2-pegged price escalation:
        //   Attempt 1 — tight buffer (e.g. 0.1%). Limit price hugs the touch;
        //               fills only if the book hasn't moved between fetch and
        //               order.
        //   Attempt 2 — wider buffer (e.g. 0.5%). Absorbs a small adverse
        //               move after the first attempt missed.
        //
        // Both attempts share the same CLOID — Hyperliquid deduplicates by
        // CLOID, so if attempt 1 actually filled but the response was lost,
        // attempt 2 is rejected instead of opening a second position.
        const buffers = [this.initialL2Buffer, this.retryL2Buffer];
        for (const buffer of buffers) {
            const result = await this.attemptIocSwap(params, symbol, buffer, cloid);
            if (result !== null) return result;
        }

        const diagnostics = {
            bestBid: params.l2Touch.bestBid.toNumber(),
            bestAsk: params.l2Touch.bestAsk.toNumber(),
            side: params.side,
            amount: params.amount.toNumber(),
            symbol: params.symbol,
        };
        this.logger.warn({ ...diagnostics }, 'IOC swap failed — aborting, notifying user');

        const errorMessage =
            `Order didn't fill at the best available L2 price after 2 attempts. ` +
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
        l2Buffer: number,
        orderId: string,
    ): Promise<SpotSwapResult | null> {
        if (params.side === SwapSide.UsdcToBase) {
            return this.attemptIocBuy(params, symbol, l2Buffer, orderId);
        }
        return this.attemptIocSell(params, symbol, l2Buffer, orderId);
    }

    private async attemptIocBuy(
        params: SpotSwapParams,
        symbol: TradingSymbol,
        l2Buffer: number,
        orderId: string,
    ): Promise<SpotSwapResult | null> {
        // Buy: pay up to bestAsk * (1 + l2Buffer); baseAmount = spentUsdc / limitPrice
        const limitPrice = Price.from(params.l2Touch.bestAsk.toNumber() * (1 + l2Buffer));
        const baseAmount = Decimal.from(params.amount.toNumber() / limitPrice.toNumber());
        const bufferLabel = formatBufferPct(l2Buffer);

        this.logger.info(
            { limitPrice: limitPrice.toNumber(), buffer: bufferLabel },
            `Attempting IOC market buy (${bufferLabel})`,
        );

        // Exceptions (e.g. AgentNotApprovedError, network) propagate to the caller —
        // they indicate a non-retriable condition and must surface above this loop.
        const result = await this.exchange.placeSpotMarketBuy({
            symbol,
            amount: baseAmount,
            limitPrice,
            orderId,
            accountAddress: params.accountAddress,
        });

        if (result.status !== OrderStatus.Filled) return null;

        const notionalUsdc = baseAmount.toNumber() * limitPrice.toNumber();
        this.logger.info({ notionalUsdc }, `IOC buy filled (${bufferLabel})`);

        return {
            success: true,
            filledBase: baseAmount.toNumber(),
            notionalUsdc,
        };
    }

    private async attemptIocSell(
        params: SpotSwapParams,
        symbol: TradingSymbol,
        l2Buffer: number,
        orderId: string,
    ): Promise<SpotSwapResult | null> {
        // Sell: accept down to bestBid * (1 - l2Buffer)
        const limitPrice = Price.from(params.l2Touch.bestBid.toNumber() * (1 - l2Buffer));
        const bufferLabel = formatBufferPct(l2Buffer);

        this.logger.info(
            { limitPrice: limitPrice.toNumber(), buffer: bufferLabel },
            `Attempting IOC market sell (${bufferLabel})`,
        );

        // Exceptions propagate to the caller — see buy branch comment above.
        const result = await this.exchange.placeSpotMarketSell({
            symbol,
            amount: params.amount,
            limitPrice,
            orderId,
            accountAddress: params.accountAddress,
        });

        if (result.status !== OrderStatus.Filled) return null;

        const notionalUsdc = params.amount.toNumber() * limitPrice.toNumber();
        this.logger.info({ notionalUsdc }, `IOC sell filled (${bufferLabel})`);

        return {
            success: true,
            filledBase: params.amount.toNumber(),
            notionalUsdc,
        };
    }
}
