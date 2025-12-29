import { Injectable } from '@nestjs/common';
import { HyperliquidOrderClient } from '../../../secondary/client/hyperliquid/hyperliquid-order.client';
import { PostgresOrderRepository } from '../../../secondary/repository/order/postgres-order.repository';
import { Order } from '../../domain/order/order';
import { OrderType } from '../../domain/order/order-type';
import { OrderStatus } from '../../domain/order/order-status';
import { ExchangeCloid } from '../../domain/exchange-order/exchange-cloid';
import { ExchangePlaceOrderResult } from '../../domain/exchange-order/exchange-place-order-result';
import { EventBus } from '../../../../../infra/events/event-bus.service';
import { TradeExecutedEvent } from '../../../../../domain/events/trade-executed.event';
import { logger } from '../../../../../infra/logger/logger';
import { OrderRefillResult } from './order-refill-result';
import { RefillParams } from './refill-params';
import { Grid } from '@components/trading/core/domain/grid/grid';
import { ProfitCalculatorService } from '../profit-calculator/profit-calculator.service';
import { Decimal } from '../../../../../domain/primitives/decimal';

@Injectable()
export class OrderRefillService {
    private readonly logger = logger.child({ context: OrderRefillService.name });

    constructor(
        private readonly orderClient: HyperliquidOrderClient,
        private readonly orderRepository: PostgresOrderRepository,
        private readonly eventBus: EventBus,
        private readonly profitCalculator: ProfitCalculatorService,
    ) {}

    async process(filledOrder: Order, grid: Grid): Promise<OrderRefillResult> {
        this.logOrderProcessing(filledOrder, grid);

        try {
            const refillParams = RefillParams.calc(filledOrder, grid);
            if (!refillParams) {
                return this.handleEdgeLevel(filledOrder);
            }

            const refillOrder = await this.createAndSavePendingOrder(grid, refillParams);
            const placeResult = await this.placeOrderOnExchange(grid, refillParams);

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
        const refillOrder = Order.create({
            symbol: grid.symbol,
            type: OrderType.Limit,
            side: refillParams.side,
            price: refillParams.price,
            amount: refillParams.amount,
            status: OrderStatus.Pending,
            gridId: grid.id.toString(),
            levelIndex: refillParams.levelIndex,
            cloid: ExchangeCloid.create(grid.id),
        });

        await this.orderRepository.save(refillOrder);

        this.logger.debug(
            { orderId: refillOrder.id.toString(), levelIndex: refillParams.levelIndex },
            'Refill order saved with pending status',
        );

        return refillOrder;
    }

    private async placeOrderOnExchange(grid: Grid, refillParams: RefillParams) {
        return await this.orderClient.placeSpotOrder({
            symbol: grid.symbol,
            side: refillParams.side,
            price: refillParams.price,
            amount: refillParams.amount,
            gridId: grid.id,
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

        this.eventBus.publish(
            new TradeExecutedEvent(
                grid.id.toString(),
                grid.symbol.toString(),
                filledOrder.side,
                filledPrice,
                filledAmount,
                filledPrice * filledAmount,
                profit?.toNumber() ?? null,
                filledOrder.levelIndex,
                grid.levels,
            ),
        );
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
}
