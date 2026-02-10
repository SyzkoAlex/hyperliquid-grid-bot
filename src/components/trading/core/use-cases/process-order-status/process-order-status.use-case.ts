import { Injectable } from '@nestjs/common';
import { logger } from '../../../../../infra/logger/logger';
import { PostgresOrderRepository } from '../../../secondary/repository/order/postgres-order.repository';
import { PostgresGridRepository } from '../../../secondary/repository/grid/postgres-grid.repository';
import { OrderRefillService } from '../../services/order-refill/order-refill.service';
import { Order } from '@domain/order/order';
import { OrderStatus } from '@domain/order/order-status';
import { GridStatus } from '@domain/grid/grid-status';
import { HyperliquidWsOrderStatus } from '@infra/hyperliquid/types/hyperliquid-ws-user-event';

export interface ProcessOrderStatusParams {
    orderStatus: HyperliquidWsOrderStatus;
}

export interface ProcessOrderStatusResult {
    success: boolean;
    isGridOrder: boolean;
    orderId: number;
    status?: string;
    error?: string;
}

/**
 * Process Order Status Use Case
 *
 * Handles order status changes received via WebSocket userEvents channel.
 *
 * ## Statuses:
 * - filled → update status, trigger grid refill
 * - canceled → update status to cancelled
 * - marginCanceled → update status to cancelled (margin call)
 * - rejected → update status to rejected
 * - open → order is now active (no action needed)
 * - triggered → stop order triggered (no action for grid)
 */
@Injectable()
export class ProcessOrderStatusUseCase {
    private readonly logger = logger.child({ context: ProcessOrderStatusUseCase.name });

    constructor(
        private readonly orderRepository: PostgresOrderRepository,
        private readonly gridRepository: PostgresGridRepository,
        private readonly orderRefillService: OrderRefillService,
    ) {}

    async execute(params: ProcessOrderStatusParams): Promise<ProcessOrderStatusResult> {
        const { orderStatus } = params;
        const exchangeOrderId = orderStatus.order.oid.toString();
        const status = orderStatus.status;

        this.logger.debug(
            {
                oid: orderStatus.order.oid,
                status,
                coin: orderStatus.order.coin,
            },
            'Processing order status change',
        );

        try {
            // Find grid order by exchange order ID
            const gridOrder = await this.orderRepository.findOneByExchangeOrderId(exchangeOrderId);

            if (!gridOrder) {
                this.logger.debug({ oid: orderStatus.order.oid }, 'Order not found in grid orders');
                return {
                    success: true,
                    isGridOrder: false,
                    orderId: orderStatus.order.oid,
                    status,
                };
            }

            // Handle different statuses
            switch (status) {
                case 'filled':
                    return this.handleFilled(orderStatus, gridOrder);

                case 'canceled':
                case 'marginCanceled':
                    return this.handleCanceled(orderStatus, gridOrder);

                case 'rejected':
                    return this.handleFailed(orderStatus, gridOrder);

                case 'open':
                case 'triggered':
                    // No action needed for these statuses
                    return {
                        success: true,
                        isGridOrder: true,
                        orderId: orderStatus.order.oid,
                        status,
                    };

                default:
                    this.logger.warn(
                        { status, oid: orderStatus.order.oid },
                        'Unknown order status',
                    );
                    return {
                        success: true,
                        isGridOrder: true,
                        orderId: orderStatus.order.oid,
                        status,
                    };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(
                { error, oid: orderStatus.order.oid },
                'Error processing order status',
            );

            return {
                success: false,
                isGridOrder: false,
                orderId: orderStatus.order.oid,
                status,
                error: errorMessage,
            };
        }
    }

    /**
     * Handle filled order - trigger grid refill
     */
    private async handleFilled(
        orderStatus: HyperliquidWsOrderStatus,
        gridOrder: Order,
    ): Promise<ProcessOrderStatusResult> {
        // Skip if already processed
        if (gridOrder.status === OrderStatus.Filled) {
            this.logger.debug(
                { oid: orderStatus.order.oid },
                'Order already marked as filled, skipping',
            );
            return {
                success: true,
                isGridOrder: true,
                orderId: orderStatus.order.oid,
                status: 'filled',
            };
        }

        // Get the associated grid
        const grid = await this.gridRepository.findOneById(gridOrder.gridId);

        if (!grid) {
            this.logger.warn({ gridId: gridOrder.gridId }, 'Grid not found for order');
            return {
                success: false,
                isGridOrder: true,
                orderId: orderStatus.order.oid,
                status: 'filled',
                error: 'Grid not found',
            };
        }

        // Check if grid is still running
        if (grid.status !== GridStatus.Running) {
            this.logger.info(
                { gridId: gridOrder.gridId, gridStatus: grid.status },
                'Grid is not running, skipping fill processing',
            );
            return {
                success: true,
                isGridOrder: true,
                orderId: orderStatus.order.oid,
                status: 'filled',
            };
        }

        // Update order status to filled
        const fillTime = new Date(orderStatus.statusTimestamp);
        await this.orderRepository.updateStatus(
            gridOrder.id.toString(),
            OrderStatus.Filled,
            fillTime,
        );

        this.logger.info(
            { oid: orderStatus.order.oid, gridOrderId: gridOrder.id.toString() },
            'Order marked as filled via userEvents',
        );

        // Re-fetch order to get updated status (Order entity is immutable)
        const filledOrder = await this.orderRepository.findOneByExchangeOrderId(
            orderStatus.order.oid.toString(),
        );

        if (!filledOrder) {
            this.logger.error(
                { oid: orderStatus.order.oid },
                'Failed to re-fetch filled order for refill processing',
            );
            return {
                success: false,
                isGridOrder: true,
                orderId: orderStatus.order.oid,
                status: 'filled',
                error: 'Failed to re-fetch order',
            };
        }

        // Process refill logic
        const result = await this.orderRefillService.process(filledOrder, grid);

        if (!result.success) {
            this.logger.error(
                { oid: orderStatus.order.oid, error: result.error },
                'Failed to process refill for filled order',
            );
        }

        return {
            success: true,
            isGridOrder: true,
            orderId: orderStatus.order.oid,
            status: 'filled',
        };
    }

    /**
     * Handle canceled order - remove from active orders
     */
    private async handleCanceled(
        orderStatus: HyperliquidWsOrderStatus,
        gridOrder: Order,
    ): Promise<ProcessOrderStatusResult> {
        // Skip if already cancelled
        if (gridOrder.status === OrderStatus.Cancelled) {
            return {
                success: true,
                isGridOrder: true,
                orderId: orderStatus.order.oid,
                status: orderStatus.status,
            };
        }

        // Update order status to cancelled
        await this.orderRepository.updateStatus(gridOrder.id.toString(), OrderStatus.Cancelled);

        this.logger.info(
            {
                oid: orderStatus.order.oid,
                gridOrderId: gridOrder.id.toString(),
                reason: orderStatus.status,
            },
            'Order marked as cancelled via userEvents',
        );

        return {
            success: true,
            isGridOrder: true,
            orderId: orderStatus.order.oid,
            status: orderStatus.status,
        };
    }

    /**
     * Handle rejected order
     */
    private async handleFailed(
        orderStatus: HyperliquidWsOrderStatus,
        gridOrder: Order,
    ): Promise<ProcessOrderStatusResult> {
        await this.orderRepository.updateStatus(gridOrder.id.toString(), OrderStatus.Failed);

        this.logger.warn(
            { oid: orderStatus.order.oid, gridOrderId: gridOrder.id.toString() },
            'Order failed via userEvents',
        );

        return {
            success: true,
            isGridOrder: true,
            orderId: orderStatus.order.oid,
            status: 'failed',
        };
    }
}
