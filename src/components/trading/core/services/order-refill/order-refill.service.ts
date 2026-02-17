import { Inject, Injectable } from '@nestjs/common';
import { HyperliquidOrderClient } from '../../../secondary/client/hyperliquid/hyperliquid-order.client';
import { PostgresOrderRepository } from '../../../secondary/repository/order/postgres-order.repository';
import { Order } from '@domain/order/order';
import { OrderId } from '@domain/order/order-id';
import { OrderSide } from '@domain/order/order-side';
import { OrderType } from '@domain/order/order-type';
import { OrderStatus } from '@domain/order/order-status';
import { ExchangePlaceOrderResult } from '@components/trading/core/domain/exchange-order/exchange-place-order-result';
import { EVENT_BUS, EventBus } from '@infra/events/event-bus.port';
import { OrderOpenedEvent } from '@domain/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/events/trading/order-closed.event';
import { logger } from '@infra/logger/logger';
import { OrderRefillResult } from './order-refill-result';
import { RefillParams } from './refill-params';
import { Grid } from '@domain/grid/grid';
import { ProfitCalculatorService } from '../profit-calculator/profit-calculator.service';
import { Decimal } from '@domain/primitives/decimal';

@Injectable()
export class OrderRefillService {
    private readonly logger = logger.child({ context: OrderRefillService.name });

    constructor(
        private readonly orderClient: HyperliquidOrderClient,
        private readonly orderRepository: PostgresOrderRepository,
        @Inject(EVENT_BUS) private readonly eventBus: EventBus,
        private readonly profitCalculator: ProfitCalculatorService,
    ) {}

    async processMany(filledOrders: Order[], grid: Grid): Promise<number> {
        const currentPrice = await this.orderClient.getSpotPrice(grid.symbol.toString());
        const eligible = this.filterEligible(filledOrders, grid, currentPrice);

        let placed = 0;
        for (const order of eligible) {
            const result = await this.processOne(order, grid);
            if (result.success) placed++;
        }
        return placed;
    }

    async processOne(filledOrder: Order, grid: Grid): Promise<OrderRefillResult> {
        this.logOrderProcessing(filledOrder, grid);

        try {
            const refillParams = RefillParams.calc(filledOrder, grid);
            if (!refillParams) {
                return this.handleEdgeLevel(filledOrder);
            }

            const refillOrder = await this.createAndSavePendingOrder(grid, refillParams);
            const placeResult = await this.placeOrderOnExchange(refillOrder, grid, refillParams);

            if (!this.isPlacementSuccessful(placeResult)) {
                return await this.handlePlacementFailure(refillOrder, placeResult);
            }

            await this.updateOrderAsPlaced(refillOrder, placeResult);

            const profit = this.profitCalculator.calculate(filledOrder, grid);
            await this.publishTradeEvent(filledOrder, grid, profit);

            this.logSuccess(grid, filledOrder, refillOrder, refillParams, profit);

            return OrderRefillResult.success(refillOrder, profit?.toNumber());
        } catch (error) {
            return this.handleError(error, filledOrder);
        }
    }

    private logOrderProcessing(filledOrder: Order, grid: Grid): void {
        this.logger.info(
            {
                gridId: grid.id.toString(),
                orderId: filledOrder.id.toString(),
                side: filledOrder.side,
                level: filledOrder.levelIndex,
                price: filledOrder.price?.toNumber(),
            },
            'Processing filled order',
        );
    }

    private handleEdgeLevel(filledOrder: Order): OrderRefillResult {
        this.logger.warn(
            { orderId: filledOrder.id.toString(), levelIndex: filledOrder.levelIndex },
            'Cannot calculate refill params (edge level)',
        );

        return OrderRefillResult.failure('Edge level - no refill needed');
    }

    private async createAndSavePendingOrder(
        grid: Grid,
        refillParams: RefillParams,
    ): Promise<Order> {
        const orderId = OrderId.create();
        const refillOrder = Order.create({
            id: orderId,
            symbol: grid.symbol,
            type: OrderType.Limit,
            side: refillParams.side,
            price: refillParams.price,
            amount: refillParams.amount,
            status: OrderStatus.Pending,
            gridId: grid.id,
            levelIndex: refillParams.levelIndex,
        });

        await this.orderRepository.save(refillOrder);

        this.logger.debug(
            { orderId: refillOrder.id.toString(), levelIndex: refillParams.levelIndex },
            'Refill order saved with pending status',
        );

        return refillOrder;
    }

    private async placeOrderOnExchange(refillOrder: Order, grid: Grid, refillParams: RefillParams) {
        return await this.orderClient.placeSpotOrder({
            symbol: grid.symbol,
            side: refillParams.side,
            price: refillParams.price,
            amount: refillParams.amount,
            orderId: refillOrder.id,
        });
    }

    private isPlacementSuccessful(placeResult: ExchangePlaceOrderResult): boolean {
        return Boolean(placeResult.exchangeOrderId && placeResult.status !== OrderStatus.Failed);
    }

    private async handlePlacementFailure(
        refillOrder: Order,
        placeResult: ExchangePlaceOrderResult,
    ): Promise<OrderRefillResult> {
        await this.orderRepository.updateStatus(refillOrder.id.toString(), OrderStatus.Failed);

        this.logger.error(
            { error: placeResult.error, orderId: refillOrder.id.toString() },
            'Failed to place refill order - marked as failed',
        );

        return OrderRefillResult.failure(placeResult.error || 'Failed to place refill order');
    }

    private async updateOrderAsPlaced(
        refillOrder: Order,
        placeResult: ExchangePlaceOrderResult,
    ): Promise<void> {
        await this.orderRepository.updateExchangeOrderId(
            refillOrder.id.toString(),
            placeResult.exchangeOrderId,
            OrderStatus.Placed,
            new Date(),
        );

        this.logger.debug(
            {
                orderId: refillOrder.id.toString(),
                exchangeOrderId: placeResult.exchangeOrderId,
            },
            'Refill order placed and updated with exchangeOrderId',
        );
    }

    private async publishTradeEvent(
        filledOrder: Order,
        grid: Grid,
        profit: Decimal | null,
    ): Promise<void> {
        const filledPrice = filledOrder.price?.toNumber() ?? 0;
        const filledAmount = filledOrder.amount.toNumber();
        const total = filledPrice * filledAmount;

        if (profit !== null) {
            const closedEvent = new OrderClosedEvent(
                grid.id.toString(),
                grid.symbol.toString(),
                filledOrder.side,
                filledPrice,
                filledAmount,
                total,
                profit.toNumber(),
                filledOrder.levelIndex,
                grid.levels,
            );
            await this.eventBus.publish(closedEvent);
            return;
        }

        const openedEvent = new OrderOpenedEvent(
            grid.id.toString(),
            grid.symbol.toString(),
            filledOrder.side,
            filledPrice,
            filledAmount,
            total,
            filledOrder.levelIndex,
            grid.levels,
        );
        await this.eventBus.publish(openedEvent);
    }

    private logSuccess(
        grid: Grid,
        filledOrder: Order,
        refillOrder: Order,
        refillParams: RefillParams,
        profit: Decimal | null,
    ): void {
        this.logger.info(
            {
                gridId: grid.id.toString(),
                filledOrderId: filledOrder.id.toString(),
                refillOrderId: refillOrder.id.toString(),
                refillSide: refillParams.side,
                refillLevel: refillParams.levelIndex,
                profit: profit?.toNumber() ?? null,
            },
            'Refill order placed successfully',
        );
    }

    private handleError(error: unknown, filledOrder: Order): OrderRefillResult {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        this.logger.error(
            {
                errorMessage,
                errorStack,
                orderId: filledOrder.id.toString(),
            },
            'Error processing filled order',
        );

        return OrderRefillResult.failure(errorMessage);
    }

    private filterEligible(filledOrders: Order[], grid: Grid, currentPrice: number): Order[] {
        const seen = new Set<string>();
        const result: Order[] = [];

        for (const order of filledOrders) {
            const params = RefillParams.calc(order, grid);
            if (!params) continue;

            const refillPrice = params.price.toNumber();
            const isCorrectSide =
                params.side === OrderSide.Buy
                    ? refillPrice < currentPrice
                    : refillPrice > currentPrice;

            if (!isCorrectSide) {
                this.logger.debug(
                    { levelIndex: params.levelIndex, side: params.side, refillPrice, currentPrice },
                    'Refill skipped: wrong side of market',
                );
                continue;
            }

            const key = `${params.levelIndex}-${params.side}`;
            if (seen.has(key)) {
                this.logger.debug(
                    { levelIndex: params.levelIndex, side: params.side },
                    'Refill skipped: duplicate',
                );
                continue;
            }

            seen.add(key);
            result.push(order);
        }

        return result;
    }
}
