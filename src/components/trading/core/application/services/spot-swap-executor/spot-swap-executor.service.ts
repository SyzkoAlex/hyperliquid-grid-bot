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
import { ExchangePlaceOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-result';
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
    /**
     * Minimum fill ratio — fills below this fraction of the requested amount
     * are treated as dust fills (thin order book) and retried with a wider
     * price buffer.
     */
    private readonly minFillRatio: number;

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        config: ConfigService<Config, true>,
    ) {
        const { initialL2BufferPct, retryL2BufferPct, minFillRatioPct } = config.get('swap', {
            infer: true,
        });
        this.initialL2Buffer = initialL2BufferPct;
        this.retryL2Buffer = retryL2BufferPct;
        this.minFillRatio = minFillRatioPct;
    }

    async execute(params: SpotSwapParams): Promise<SpotSwapResult> {
        const symbol = TradingSymbol.create(params.symbol);

        // Two-attempt L2-pegged price escalation:
        //   Attempt 1 — tight buffer (e.g. 0.1%). Limit price hugs the touch.
        //   Attempt 2 — wider buffer (e.g. 0.5%). Reaches deeper into the book
        //               when attempt 1 produced no fill or a dust fill.
        //
        // Each attempt uses its own CLOID. A dust fill on attempt 1 (< minFillRatio)
        // returns null so attempt 2 can run with the wider buffer. Because a dust fill
        // means the exchange response was received and the CLOID is already consumed,
        // reusing it for attempt 2 would be rejected — hence a fresh CLOID per attempt.
        // The trade-off: a lost response on a full fill could theoretically lead to a
        // duplicate buy or sell on attempt 2, but for IOC spot swaps this is acceptable
        // and far less harmful than silently accepting a ~0.6 % fill on a large order.
        const buffers = [this.initialL2Buffer, this.retryL2Buffer];
        for (const buffer of buffers) {
            const result = await this.attemptIocSwap(params, symbol, buffer, uuidv4());
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
            `Order didn't fill at the best available L2 price after ${buffers.length} attempts. ` +
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

        return this.handleFillResult(result, baseAmount, limitPrice, bufferLabel, 'buy');
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

        return this.handleFillResult(result, params.amount, limitPrice, bufferLabel, 'sell');
    }

    /**
     * Interprets an IOC exchange result and returns a `SpotSwapResult` on
     * success, or `null` when the caller should retry with a wider buffer.
     *
     * Returns `null` for:
     *  - Unfilled / not-Filled status
     *  - Zero-filled size (treat as a miss)
     *  - Dust fills (< minFillRatio of requestedAmount)
     */
    private handleFillResult(
        result: ExchangePlaceOrderResult,
        requestedAmount: Decimal,
        limitPrice: Price,
        bufferLabel: string,
        side: 'buy' | 'sell',
    ): SpotSwapResult | null {
        if (result.status !== OrderStatus.Filled) return null;

        // Use actual fill data from the exchange — IOC orders can be partially
        // filled. If the exchange reports zero filled size, treat as a miss and
        // allow the retry loop to escalate to the next buffer tier.
        const filledBase = result.filledSize ?? 0;
        if (filledBase <= 0) return null;

        // Reject dust fills: if the exchange filled less than minFillRatio of
        // the requested amount the order book is too thin at this price level.
        // Return null so the caller retries with a wider buffer.
        const fillRatio = filledBase / requestedAmount.toNumber();
        if (fillRatio < this.minFillRatio) {
            this.logger.warn(
                {
                    requested: requestedAmount.toNumber(),
                    filledBase,
                    fillRatio,
                    buffer: bufferLabel,
                },
                `IOC ${side} dust fill (<${this.minFillRatio * 100}% of requested) — retrying with wider buffer`,
            );
            return null;
        }

        const avgPx =
            result.avgPrice != null && result.avgPrice > 0
                ? result.avgPrice
                : limitPrice.toNumber();
        const notionalUsdc = filledBase * avgPx;
        this.logger.info(
            {
                requested: requestedAmount.toNumber(),
                filledBase,
                fillRatio,
                notionalUsdc,
            },
            `IOC ${side} filled (${bufferLabel})`,
        );

        return { success: true, filledBase, notionalUsdc };
    }
}
