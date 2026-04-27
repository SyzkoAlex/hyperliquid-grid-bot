import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { OrderRefillService } from '@components/trading/core/application/services/order-refill/order-refill.service';
import { RefillOrderPlacementService } from '@components/trading/core/application/services/refill-order-placement/refill-order-placement.service';
import { OrderFeeSyncService } from '@components/trading/core/application/services/order-fee-sync/order-fee-sync.service';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import { RefillParams } from '@components/trading/core/application/services/order-refill/refill-params';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { OrderStatusUpdate } from './order-status-update';
import { OrderStatus } from '@domain/models/order/order-status';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';

export interface ProcessOrderStatusParams {
    orderStatus: OrderStatusUpdate;
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
        private readonly refillPlacement: RefillOrderPlacementService,
        private readonly feeSyncService: OrderFeeSyncService,
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
    ) {}

    async execute(params: ProcessOrderStatusParams): Promise<ProcessOrderStatusResult> {
        const { orderStatus } = params;
        const exchangeOrderId = orderStatus.exchangeOrderId.toString();
        const status = orderStatus.status;

        this.logger.debug(
            { oid: orderStatus.exchangeOrderId, status, coin: orderStatus.coin },
            'Processing order status change',
        );

        try {
            const gridOrder = await this.grids.findOrderByExchangeId(exchangeOrderId);

            if (!gridOrder) {
                this.logger.debug(
                    { oid: orderStatus.exchangeOrderId },
                    'Order not found in grid orders',
                );
                return {
                    success: true,
                    isGridOrder: false,
                    orderId: orderStatus.exchangeOrderId,
                    status,
                };
            }

            switch (status) {
                case 'filled':
                    return this.handleFilled(orderStatus, gridOrder);

                case 'selfTradeCanceled':
                    return this.handleSelfTradeCanceled(orderStatus, gridOrder);

                case 'canceled':
                case 'marginCanceled':
                case 'vaultWithdrawalCanceled':
                case 'openInterestCapCanceled':
                case 'reduceOnlyCanceled':
                case 'siblingFilledCanceled':
                case 'delistedCanceled':
                case 'liquidatedCanceled':
                case 'scheduledCancel':
                    return this.handleCanceled(orderStatus, gridOrder);

                case 'rejected':
                case 'tickRejected':
                case 'minTradeNtlRejected':
                case 'perpMarginRejected':
                case 'reduceOnlyRejected':
                case 'badAloPxRejected':
                case 'iocCancelRejected':
                case 'badTriggerPxRejected':
                case 'marketOrderNoLiquidityRejected':
                case 'positionIncreaseAtOpenInterestCapRejected':
                case 'positionFlipAtOpenInterestCapRejected':
                case 'tooAggressiveAtOpenInterestCapRejected':
                case 'openInterestIncreaseRejected':
                case 'insufficientSpotBalanceRejected':
                case 'oracleRejected':
                case 'perpMaxPositionRejected':
                    return this.handleFailed(orderStatus, gridOrder);

                case 'open':
                case 'triggered':
                    return {
                        success: true,
                        isGridOrder: true,
                        orderId: orderStatus.exchangeOrderId,
                        status,
                    };

                default:
                    this.logger.warn(
                        { status, oid: orderStatus.exchangeOrderId },
                        'Unknown order status',
                    );
                    return {
                        success: true,
                        isGridOrder: true,
                        orderId: orderStatus.exchangeOrderId,
                        status,
                    };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(
                { error, oid: orderStatus.exchangeOrderId },
                'Error processing order status',
            );

            return {
                success: false,
                isGridOrder: false,
                orderId: orderStatus.exchangeOrderId,
                status,
                error: errorMessage,
            };
        }
    }

    private async handleFilled(
        orderStatus: OrderStatusUpdate,
        gridOrder: OrderDto,
    ): Promise<ProcessOrderStatusResult> {
        if (gridOrder.status === OrderStatus.Filled) {
            this.logger.debug(
                { oid: orderStatus.exchangeOrderId },
                'Order already marked as filled, skipping',
            );
            return {
                success: true,
                isGridOrder: true,
                orderId: orderStatus.exchangeOrderId,
                status: 'filled',
            };
        }

        const grid = await this.grids.findGridById(gridOrder.gridId);

        if (!grid) {
            this.logger.warn({ gridId: gridOrder.gridId }, 'Grid not found for order');
            return {
                success: false,
                isGridOrder: true,
                orderId: orderStatus.exchangeOrderId,
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
                orderId: orderStatus.exchangeOrderId,
                status: 'filled',
            };
        }

        const fillTime = new Date(orderStatus.statusTimestamp);
        await this.grids.updateOrderStatus(gridOrder.id, OrderStatus.Filled, fillTime);

        const accountAddress = await this.getFirstActiveAccountAddress();
        this.feeSyncService
            .syncFee(
                gridOrder.id,
                orderStatus.exchangeOrderId.toString(),
                orderStatus.statusTimestamp,
                accountAddress ?? '',
            )
            .catch(() => {});

        this.logger.info(
            { oid: orderStatus.exchangeOrderId, gridOrderId: gridOrder.id },
            'Order marked as filled via userEvents',
        );

        const filledOrder = await this.grids.findOrderByExchangeId(
            orderStatus.exchangeOrderId.toString(),
        );

        if (!filledOrder) {
            this.logger.error(
                { oid: orderStatus.exchangeOrderId },
                'Failed to re-fetch filled order for refill processing',
            );
            return {
                success: false,
                isGridOrder: true,
                orderId: orderStatus.exchangeOrderId,
                status: 'filled',
                error: 'Failed to re-fetch order',
            };
        }

        const result = await this.orderRefillService.processOne(
            filledOrder,
            grid,
            accountAddress ?? '',
        );

        if (!result.success) {
            this.logger.error(
                { oid: orderStatus.exchangeOrderId, error: result.error },
                'Failed to process refill for filled order',
            );
        }

        return {
            success: true,
            isGridOrder: true,
            orderId: orderStatus.exchangeOrderId,
            status: 'filled',
        };
    }

    private async handleSelfTradeCanceled(
        orderStatus: OrderStatusUpdate,
        gridOrder: OrderDto,
    ): Promise<ProcessOrderStatusResult> {
        if (gridOrder.status !== OrderStatus.Cancelled) {
            await this.grids.updateOrderStatus(gridOrder.id, OrderStatus.Cancelled);
            this.logger.warn(
                {
                    oid: orderStatus.exchangeOrderId,
                    gridOrderId: gridOrder.id,
                    levelIndex: gridOrder.levelIndex,
                    side: gridOrder.side,
                },
                'Order cancelled due to self-trade prevention, attempting recovery',
            );
        }

        const grid = await this.grids.findGridById(gridOrder.gridId);

        if (!grid || grid.status !== GridStatus.Running) {
            return {
                success: true,
                isGridOrder: true,
                orderId: orderStatus.exchangeOrderId,
                status: 'selfTradeCanceled',
            };
        }

        const activeOrders = await this.grids.findActiveOrdersByGridId(grid.id);
        const hasConflict = activeOrders.some(
            (o) => o.levelIndex === gridOrder.levelIndex && o.side !== gridOrder.side,
        );

        if (hasConflict) {
            this.logger.warn(
                {
                    oid: orderStatus.exchangeOrderId,
                    levelIndex: gridOrder.levelIndex,
                    side: gridOrder.side,
                },
                'STP recovery skipped: conflicting order on opposite side at same level',
            );
            return {
                success: true,
                isGridOrder: true,
                orderId: orderStatus.exchangeOrderId,
                status: 'selfTradeCanceled',
            };
        }

        const params = new RefillParams(
            gridOrder.side,
            gridOrder.levelIndex,
            Price.from(gridOrder.price!),
            Decimal.from(gridOrder.amount),
        );

        const stpAccountAddress = await this.getFirstActiveAccountAddress();
        const result = await this.refillPlacement.placeRefillOrder(
            grid,
            params,
            stpAccountAddress ?? '',
        );

        if (result.success) {
            this.logger.info(
                {
                    oid: orderStatus.exchangeOrderId,
                    levelIndex: gridOrder.levelIndex,
                    side: gridOrder.side,
                },
                'Order re-placed after STP cancellation',
            );
        } else {
            this.logger.warn(
                {
                    oid: orderStatus.exchangeOrderId,
                    levelIndex: gridOrder.levelIndex,
                    side: gridOrder.side,
                    error: result.error,
                },
                'STP recovery failed to re-place order',
            );
        }

        return {
            success: true,
            isGridOrder: true,
            orderId: orderStatus.exchangeOrderId,
            status: 'selfTradeCanceled',
        };
    }

    private async handleCanceled(
        orderStatus: OrderStatusUpdate,
        gridOrder: OrderDto,
    ): Promise<ProcessOrderStatusResult> {
        if (gridOrder.status === OrderStatus.Cancelled) {
            return {
                success: true,
                isGridOrder: true,
                orderId: orderStatus.exchangeOrderId,
                status: orderStatus.status,
            };
        }

        await this.grids.updateOrderStatus(gridOrder.id, OrderStatus.Cancelled);

        this.logger.info(
            {
                oid: orderStatus.exchangeOrderId,
                gridOrderId: gridOrder.id,
                reason: orderStatus.status,
            },
            'Order marked as cancelled via userEvents',
        );

        return {
            success: true,
            isGridOrder: true,
            orderId: orderStatus.exchangeOrderId,
            status: orderStatus.status,
        };
    }

    private async handleFailed(
        orderStatus: OrderStatusUpdate,
        gridOrder: OrderDto,
    ): Promise<ProcessOrderStatusResult> {
        await this.grids.updateOrderStatus(gridOrder.id, OrderStatus.Failed);

        this.logger.warn(
            { oid: orderStatus.exchangeOrderId, gridOrderId: gridOrder.id },
            'Order failed via userEvents',
        );

        return {
            success: true,
            isGridOrder: true,
            orderId: orderStatus.exchangeOrderId,
            status: 'failed',
        };
    }

    private async getFirstActiveAccountAddress(): Promise<string | null> {
        const activeUsers = await this.usersApi.findActiveUsers();
        return activeUsers.length > 0 ? activeUsers[0].accountAddress : null;
    }
}
