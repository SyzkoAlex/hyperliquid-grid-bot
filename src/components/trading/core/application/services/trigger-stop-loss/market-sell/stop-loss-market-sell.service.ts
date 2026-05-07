import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/infra/logger/logger';
import { OrderStatus } from '@domain/models/order/order-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';

export interface StopLossMarketSellParams {
    gridId: string;
    symbol: string;
    amount: Decimal;
    currentMid: number;
    accountAddress: string;
}

export interface StopLossMarketSellResult {
    success: boolean;
    soldBaseAmount: number;
    receivedUSDC: number;
    errorMessage?: string;
}

@Injectable()
export class StopLossMarketSellService {
    private readonly logger = logger.child({ context: StopLossMarketSellService.name });

    /** Initial IOC sell slippage cap (1%). */
    static readonly INITIAL_SLIPPAGE_CAP = 0.01;
    /** Retry IOC sell slippage cap (2%). */
    static readonly RETRY_SLIPPAGE_CAP = 0.02;

    constructor(@Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort) {}

    async execute(params: StopLossMarketSellParams): Promise<StopLossMarketSellResult> {
        const { gridId, symbol, amount, currentMid, accountAddress } = params;
        const symbolObj = TradingSymbol.create(symbol);
        const midPrice = Price.from(currentMid);

        // Single CLOID for both IOC attempts — Hyperliquid deduplicates by CLOID,
        // so a lost response on attempt 1 won't result in a second live order on attempt 2.
        const cloid = uuidv4();

        const result1 = await this.attemptIocSell(
            amount,
            midPrice,
            StopLossMarketSellService.INITIAL_SLIPPAGE_CAP,
            cloid,
            symbolObj,
            accountAddress,
            gridId,
            '1%',
        );
        if (result1 !== null) return result1;

        const result2 = await this.attemptIocSell(
            amount,
            midPrice,
            StopLossMarketSellService.RETRY_SLIPPAGE_CAP,
            cloid,
            symbolObj,
            accountAddress,
            gridId,
            '2%',
        );
        if (result2 !== null) return result2;

        const errorMessage =
            `IOC sell unfilled after 2 attempts. ` +
            `mid: ${currentMid}, sell amount: ${amount.toNumber()} ${symbol}. ` +
            `Manual action required.`;

        this.logger.warn({ gridId, errorMessage }, 'IOC sell failed — aborting, notifying user');

        return {
            success: false,
            soldBaseAmount: 0,
            receivedUSDC: 0,
            errorMessage,
        };
    }

    /**
     * Places a single IOC sell at (currentMid * (1 - slippageCap)).
     * Returns a filled StopLossMarketSellResult on success, or null when the order
     * was not filled (caller should retry with a wider cap).
     */
    private async attemptIocSell(
        amount: Decimal,
        currentMid: Price,
        slippageCap: number,
        orderId: string,
        symbol: TradingSymbol,
        accountAddress: string,
        gridId: string,
        attemptLabel: string,
    ): Promise<StopLossMarketSellResult | null> {
        const limitPrice = Price.from(currentMid.toNumber() * (1 - slippageCap));

        this.logger.info(
            { gridId, limitPrice: limitPrice.toNumber(), cap: attemptLabel },
            `Attempting IOC market sell (${attemptLabel})`,
        );

        const result = await this.exchange.placeSpotMarketSell({
            symbol,
            amount,
            limitPrice,
            orderId,
            accountAddress,
        });

        if (result.status !== OrderStatus.Filled) {
            return null;
        }

        // TODO(v2): read actual fill price from exchange response once
        // ExchangePlaceOrderResult carries fill data; for now use limit price as proxy.
        const receivedUSDC = amount.toNumber() * limitPrice.toNumber();
        this.logger.info({ gridId, receivedUSDC }, `IOC sell filled (${attemptLabel})`);

        return {
            success: true,
            soldBaseAmount: amount.toNumber(),
            receivedUSDC,
        };
    }
}
