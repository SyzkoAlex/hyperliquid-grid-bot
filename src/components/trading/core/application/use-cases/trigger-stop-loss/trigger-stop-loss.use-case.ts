import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/infra/logger/logger';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import {
    EVENT_PUBLISHER_PORT,
    EventPublisherPort,
} from '@/core/application/ports/outbound/event-publisher.port';
import { UserBalanceExtractorService } from '@components/trading/core/domain/services/user-balance-extractor/user-balance-extractor.service';
import { GridStopLossTriggeredEvent } from '@domain/models/events/trading/grid-stop-loss-triggered.event';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { TriggerStopLossParams } from './trigger-stop-loss-params';
import { TriggerStopLossResult } from './trigger-stop-loss-result';

@Injectable()
export class TriggerStopLossUseCase {
    private readonly logger = logger.child({ context: TriggerStopLossUseCase.name });

    /** Initial IOC sell slippage cap (1%). */
    private static readonly INITIAL_SLIPPAGE_CAP = 0.01;
    /** Retry IOC sell slippage cap (2%). */
    private static readonly RETRY_SLIPPAGE_CAP = 0.02;

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        @Inject(EVENT_PUBLISHER_PORT) private readonly eventPublisher: EventPublisherPort,
        private readonly userBalanceExtractor: UserBalanceExtractorService,
    ) {}

    async execute(params: TriggerStopLossParams): Promise<TriggerStopLossResult> {
        const { gridId, symbol, stopLossPrice, currentMid, accountAddress } = params;

        this.logger.info(
            { gridId, symbol, stopLossPrice, currentMid },
            'Stop-loss triggered — starting teardown',
        );

        // Mark stop_loss_triggered_at so concurrent polls skip this grid.
        await this.grids.markStopLossTriggered(gridId);

        // Fetch active orders BEFORE flipping status so we capture them regardless
        // of whether the repository ever filters by grid status in the future.
        const activeOrders = await this.grids.findActiveOrdersByGridId(gridId);

        // Flip status to Stopped BEFORE selling so the next polling iteration
        // does not try to refill any orders.
        await this.grids.updateGridStatus(gridId, GridStatus.Stopped);

        for (const order of activeOrders) {
            await this.cancelOrder(order, accountAddress);
        }

        this.logger.info({ gridId, cancelledOrders: activeOrders.length }, 'Orders cancelled');

        const userState = await this.exchange.getUserSpotState(accountAddress);
        const { baseBalance } = this.userBalanceExtractor.extractBalances(userState, symbol);

        // Fetch the grid record to access initialBaseAmount (investmentBase).
        const grid = await this.grids.findGridById(gridId);

        if (!grid) {
            this.logger.error(
                { gridId },
                'Grid not found after teardown — cannot compute sell amount',
            );
            const event = this.buildEvent(params, 0, 0, false, `Grid ${gridId} not found`);
            await this.eventPublisher.publish(event);
            return {
                success: false,
                soldBaseAmount: 0,
                receivedUSDC: 0,
                errorMessage: `Grid ${gridId} not found`,
            };
        }

        const sellAmount = await this.computeGridAttributableBase(gridId, grid, baseBalance);

        if (sellAmount.lte(Decimal.zero())) {
            this.logger.info({ gridId }, 'Nothing to sell — zero grid-attributable base balance');
            const event = this.buildEvent(params, 0, 0, true, undefined);
            await this.eventPublisher.publish(event);
            return { success: true, soldBaseAmount: 0, receivedUSDC: 0 };
        }

        const midPrice = Price.from(currentMid);

        // Single CLOID for both IOC attempts — Hyperliquid deduplicates by CLOID,
        // so a lost response on attempt 1 won't result in a second live order on attempt 2.
        const cloid = uuidv4();

        const result = await this.attemptMarketSell(
            params,
            sellAmount,
            midPrice,
            stopLossPrice,
            cloid,
        );

        await this.eventPublisher.publish(
            this.buildEvent(
                params,
                result.soldBaseAmount,
                result.receivedUSDC,
                result.success,
                result.errorMessage,
            ),
        );

        return result;
    }

    /**
     * Compute how much of the on-account base balance belongs to this grid.
     *
     * Grid-attributable base = initialBaseAmount + filled_buy_qty - filled_sell_qty.
     * We then clamp to the actual on-account balance so we never try to sell
     * tokens that belong to another grid or were deposited separately.
     */
    private async computeGridAttributableBase(
        gridId: string,
        grid: GridDto,
        baseBalance: Decimal,
    ): Promise<Decimal> {
        const initialBase = Decimal.from(grid.investmentBase);

        const allOrders = await this.grids.findOrdersByGridId(gridId);
        const filledOrders = allOrders.filter((o) => o.status === OrderStatus.Filled);

        const filledBuyQty = filledOrders
            .filter((o) => o.side === OrderSide.Buy)
            .reduce((sum, o) => sum + o.amount, 0);

        const filledSellQty = filledOrders
            .filter((o) => o.side === OrderSide.Sell)
            .reduce((sum, o) => sum + o.amount, 0);

        const computed = Decimal.from(initialBase.toNumber() + filledBuyQty - filledSellQty);

        // Never exceed what is actually on the account.
        const clamped = computed.gt(baseBalance) ? baseBalance : computed;

        // Guard against negative (e.g. data inconsistency).
        return clamped.lte(Decimal.zero()) ? Decimal.zero() : clamped;
    }

    private async attemptMarketSell(
        params: TriggerStopLossParams,
        amount: Decimal,
        currentMid: Price,
        stopLossPrice: number,
        cloid: string,
    ): Promise<TriggerStopLossResult> {
        const { gridId, symbol, accountAddress } = params;
        const symbolObj = TradingSymbol.create(symbol);

        const result1 = await this.attemptIocSell(
            amount,
            currentMid,
            TriggerStopLossUseCase.INITIAL_SLIPPAGE_CAP,
            cloid,
            symbolObj,
            accountAddress,
            gridId,
            '1%',
        );
        if (result1 !== null) return result1;

        const result2 = await this.attemptIocSell(
            amount,
            currentMid,
            TriggerStopLossUseCase.RETRY_SLIPPAGE_CAP,
            cloid,
            symbolObj,
            accountAddress,
            gridId,
            '2%',
        );
        if (result2 !== null) return result2;

        const errorMessage =
            `IOC sell unfilled after 2 attempts. ` +
            `SL price: ${stopLossPrice}, mid: ${currentMid.toNumber()}, ` +
            `sell amount: ${amount.toNumber()} ${symbol}. Manual action required.`;

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
     * Returns a filled TriggerStopLossResult on success, or null when the order
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
    ): Promise<TriggerStopLossResult | null> {
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

    private async cancelOrder(order: OrderDto, accountAddress: string): Promise<void> {
        if (!order.exchangeOrderId) {
            await this.grids.updateOrderStatus(order.id, OrderStatus.Cancelled);
            return;
        }

        try {
            await this.exchange.cancelSpotOrder({
                symbol: TradingSymbol.create(order.symbol),
                exchangeOrderId: order.exchangeOrderId,
                accountAddress,
            });
            await this.grids.updateOrderStatus(order.id, OrderStatus.Cancelled);
        } catch (error) {
            // Exchange cancel failed — leave DB status unchanged to avoid phantom "Cancelled" state.
            this.logger.warn(
                { error, orderId: order.id },
                'Failed to cancel order on exchange during stop-loss teardown — DB status unchanged',
            );
        }
    }

    private buildEvent(
        params: TriggerStopLossParams,
        soldBaseAmount: number,
        receivedUSDC: number,
        success: boolean,
        errorMessage: string | undefined,
    ): GridStopLossTriggeredEvent {
        return new GridStopLossTriggeredEvent(
            params.gridId,
            params.symbol,
            params.stopLossPrice,
            params.currentMid, // real mid price at the moment of trigger confirmation
            soldBaseAmount,
            receivedUSDC,
            success,
            errorMessage,
        );
    }
}
