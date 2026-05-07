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

        // Step 1: Mark stop_loss_triggered_at so concurrent polls skip this grid.
        await this.grids.markStopLossTriggered(gridId);

        // Step 2: Flip status to Stopped BEFORE selling so the next polling
        // iteration does not try to refill any orders.
        await this.grids.updateGridStatus(gridId, GridStatus.Stopped);

        // Step 3: Cancel all active orders.
        const activeOrders = await this.grids.findActiveOrdersByGridId(gridId);
        for (const order of activeOrders) {
            await this.cancelOrder(order, accountAddress);
        }

        this.logger.info({ gridId, cancelledOrders: activeOrders.length }, 'Orders cancelled');

        // Step 4: Re-fetch actual base balance after cancels settle, then compute
        // how much of that balance is attributable to this grid.
        const userState = await this.exchange.getUserSpotState(accountAddress);
        const { baseBalance } = this.userBalanceExtractor.extractBalances(userState, symbol);

        // Step 5: Fetch the grid record to access initialBaseAmount (investmentBase).
        const grid = await this.grids.findGridById(gridId);

        // Step 6: Compute grid-attributable base from fills.
        const sellAmount = await this.computeGridAttributableBase(gridId, grid, baseBalance);

        if (sellAmount.lte(Decimal.zero())) {
            this.logger.info({ gridId }, 'Nothing to sell — zero grid-attributable base balance');
            const event = this.buildEvent(params, 0, 0, true, undefined);
            await this.eventPublisher.publish(event);
            return { success: true, soldBaseAmount: 0, receivedUSDC: 0 };
        }

        // Step 7: Attempt IOC sell using the real mid at trigger time.
        const midPrice = Price.from(currentMid);

        const result = await this.attemptMarketSell(params, sellAmount, midPrice, stopLossPrice);

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
        grid: GridDto | null,
        baseBalance: Decimal,
    ): Promise<Decimal> {
        const initialBase = grid ? Decimal.from(grid.investmentBase) : Decimal.zero();

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
    ): Promise<TriggerStopLossResult> {
        const { gridId, symbol, accountAddress } = params;
        const symbolObj = TradingSymbol.create(symbol);

        // Attempt 1: 1% slippage cap
        const limitPrice1 = Price.from(
            currentMid.toNumber() * (1 - TriggerStopLossUseCase.INITIAL_SLIPPAGE_CAP),
        );
        const orderId1 = uuidv4();
        this.logger.info(
            { gridId, limitPrice: limitPrice1.toNumber(), cap: '1%' },
            'Attempting IOC market sell (attempt 1)',
        );

        const result1 = await this.exchange.placeSpotMarketSell({
            symbol: symbolObj,
            amount,
            limitPrice: limitPrice1,
            orderId: orderId1,
            accountAddress,
        });

        if (result1.status === OrderStatus.Filled) {
            // TODO(v2): read actual fill price from exchange response once
            // ExchangePlaceOrderResult carries fill data; for now use limit price as proxy.
            const receivedUSDC = amount.toNumber() * limitPrice1.toNumber();
            this.logger.info({ gridId, receivedUSDC }, 'IOC sell filled on first attempt');
            return {
                success: true,
                soldBaseAmount: amount.toNumber(),
                receivedUSDC,
            };
        }

        // Attempt 2: 2% slippage cap
        const limitPrice2 = Price.from(
            currentMid.toNumber() * (1 - TriggerStopLossUseCase.RETRY_SLIPPAGE_CAP),
        );
        const orderId2 = uuidv4();
        this.logger.info(
            { gridId, limitPrice: limitPrice2.toNumber(), cap: '2%' },
            'Attempting IOC market sell (attempt 2)',
        );

        const result2 = await this.exchange.placeSpotMarketSell({
            symbol: symbolObj,
            amount,
            limitPrice: limitPrice2,
            orderId: orderId2,
            accountAddress,
        });

        if (result2.status === OrderStatus.Filled) {
            // TODO(v2): read actual fill price from exchange response once
            // ExchangePlaceOrderResult carries fill data; for now use limit price as proxy.
            const receivedUSDC = amount.toNumber() * limitPrice2.toNumber();
            this.logger.info({ gridId, receivedUSDC }, 'IOC sell filled on second attempt');
            return {
                success: true,
                soldBaseAmount: amount.toNumber(),
                receivedUSDC,
            };
        }

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
        } catch (error) {
            this.logger.warn(
                { error, orderId: order.id },
                'Failed to cancel order on exchange during stop-loss teardown',
            );
        }

        await this.grids.updateOrderStatus(order.id, OrderStatus.Cancelled);
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
