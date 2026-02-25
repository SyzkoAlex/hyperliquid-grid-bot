import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { OrderRefillService } from '@components/trading/core/application/services/order-refill/order-refill.service';
import { OrderDto } from '@/components/grids/api/dto/order.dto';
import { HyperliquidWsOrderStatus } from '@/components/trading/adapters/outbound/exchange/hyperliquid/types/hyperliquid-ws-user-event';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridStatus } from '@domain/models/grid/grid-status';

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
 */
@Injectable()
export class ProcessOrderStatusUseCase {
    private readonly logger = logger.child({ context: ProcessOrderStatusUseCase.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        private readonly orderRefillService: OrderRefillService,
    ) {}

    async execute(params: ProcessOrderStatusParams): Promise<ProcessOrderStatusResult> {
        const { orderStatus } = params;
        const exchangeOrderId = orderStatus.order.oid.toString();
        const status = orderStatus.status;

        this.logger.debug(
            { oid: orderStatus.order.oid, status, coin: orderStatus.order.coin },
            'Processing order status change',
        );

        try {
            const gridOrder = await this.grids.findOrderByExchangeId(exchangeOrderId);

            if (!gridOrder) {
                this.logger.debug({ oid: orderStatus.order.oid }, 'Order not found in grid orders');
                return {
                    success: true,
                    isGridOrder: false,
                    orderId: orderStatus.order.oid,
                    status,
                };
            }

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

    private async handleFilled(
        orderStatus: HyperliquidWsOrderStatus,
        gridOrder: OrderDto,
    ): Promise<ProcessOrderStatusResult> {
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

        const grid = await this.grids.findGridById(gridOrder.gridId);

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

        const fillTime = new Date(orderStatus.statusTimestamp);
        await this.grids.updateOrderStatus(gridOrder.id, OrderStatus.Filled, fillTime);

        this.logger.info(
            { oid: orderStatus.order.oid, gridOrderId: gridOrder.id },
            'Order marked as filled via userEvents',
        );

        const filledOrder = await this.grids.findOrderByExchangeId(
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

        const result = await this.orderRefillService.processOne(filledOrder, grid);

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

    private async handleCanceled(
        orderStatus: HyperliquidWsOrderStatus,
        gridOrder: OrderDto,
    ): Promise<ProcessOrderStatusResult> {
        if (gridOrder.status === OrderStatus.Cancelled) {
            return {
                success: true,
                isGridOrder: true,
                orderId: orderStatus.order.oid,
                status: orderStatus.status,
            };
        }

        await this.grids.updateOrderStatus(gridOrder.id, OrderStatus.Cancelled);

        this.logger.info(
            { oid: orderStatus.order.oid, gridOrderId: gridOrder.id, reason: orderStatus.status },
            'Order marked as cancelled via userEvents',
        );

        return {
            success: true,
            isGridOrder: true,
            orderId: orderStatus.order.oid,
            status: orderStatus.status,
        };
    }

    private async handleFailed(
        orderStatus: HyperliquidWsOrderStatus,
        gridOrder: OrderDto,
    ): Promise<ProcessOrderStatusResult> {
        await this.grids.updateOrderStatus(gridOrder.id, OrderStatus.Failed);

        this.logger.warn(
            { oid: orderStatus.order.oid, gridOrderId: gridOrder.id },
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
