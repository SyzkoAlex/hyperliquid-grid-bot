import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { ExchangeCloid } from '@components/trading/core/domain/models/exchange-order/exchange-cloid';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { ExchangeOrderStatus } from '@components/trading/core/domain/models/exchange-order/exchange-order-status';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { Config } from '@/config/config.schema';
import { logger } from '@/infra/logger/logger';
import { RefillParams } from '../order-refill/refill-params';
import { RefillOrderPlacementService } from '../refill-order-placement/refill-order-placement.service';

interface PairBackoff {
    attempts: number;
    nextAttemptAt: number;
}

const ACTIVE_STATUSES = new Set([OrderStatus.Pending, OrderStatus.Placed]);
const REPLACEABLE_STATUSES = new Set([OrderStatus.Failed, OrderStatus.Cancelled]);
const LIVE_EXCHANGE_STATUSES = new Set([
    ExchangeOrderStatus.OPEN,
    ExchangeOrderStatus.FILLED,
    ExchangeOrderStatus.TRIGGERED,
]);

/**
 * Repairs grid level pairs left without an active order.
 *
 * Adjacent levels i and i+1 share one unit of capital: it rests either as a BUY at i or as a
 * SELL at i+1 (see RefillParams). A failed refill placement or an STP-cancelled order that was
 * not re-placed leaves the pair empty, and nothing else ever brings it back — the grid silently
 * shrinks.
 *
 * At most once per `emptyLevelRepairIntervalMs` per grid, pairs without a placed order are
 * resolved from the grid's order history; the most recent order of the pair decides what to place:
 * - Filled → its refill (the refill that never happened)
 * - Failed / Cancelled → the same order again
 * - Missing → nothing: it may still have executed on the exchange
 *
 * A pair is left alone while its latest order changed within the interval (in-flight refills and
 * STP recovery), or while any of its orders is still open on the exchange. A Failed/Cancelled
 * order without an exchangeOrderId is additionally looked up on the exchange by its cloid: the
 * exchange may have accepted a placement that was marked Failed locally (an HTTP timeout), and
 * once such an order fills it is gone from the open orders — re-placing it would double the
 * level's capital.
 *
 * The grid is re-read before every placement, so a grid stopped since the sync snapshot gets
 * nothing. That narrows, but does not close, the race with StopGridUseCase: it marks the grid
 * stopped before it loads the orders to cancel, yet a placement already in flight can be inserted
 * after that load, or be loaded without an exchangeOrderId yet and only flipped to Cancelled in
 * the DB while the exchange accepts it — such an order stays open and untracked on the exchange.
 *
 * An order that would cross an active opposite-side order is not placed — self-trade prevention
 * would cancel it. Unsuccessful attempts back off exponentially per pair up to
 * `emptyLevelRepairMaxBackoffMs`.
 */
@Injectable()
export class EmptyLevelRepairService {
    private readonly logger = logger.child({ context: EmptyLevelRepairService.name });
    private readonly intervalMs: number;
    private readonly maxBackoffMs: number;
    private readonly lastCheckAtByGridId = new Map<string, number>();
    private readonly backoffByPairKey = new Map<string, PairBackoff>();

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        private readonly refillPlacement: RefillOrderPlacementService,
        configService: ConfigService<Config, true>,
    ) {
        const ordersConfig = configService.get('orders', { infer: true });
        this.intervalMs = ordersConfig.emptyLevelRepairIntervalMs;
        this.maxBackoffMs = ordersConfig.emptyLevelRepairMaxBackoffMs;
    }

    /**
     * @param placedOrders the grid's active orders from the sync snapshot — pairs holding one are
     * skipped without loading the order history
     * @param exchangeOpenOrders the account's open orders on the exchange
     */
    async repair(
        grid: GridDto,
        placedOrders: OrderDto[],
        exchangeOpenOrders: ExchangeOpenOrder[],
        accountAddress: string,
    ): Promise<number> {
        if (grid.status !== GridStatus.Running) {
            this.forgetGrid(grid.id);
            return 0;
        }

        const now = Date.now();
        const lastCheckAt = this.lastCheckAtByGridId.get(grid.id);
        if (lastCheckAt !== undefined && now - lastCheckAt < this.intervalMs) return 0;
        this.lastCheckAtByGridId.set(grid.id, now);

        const placedByKey = this.groupBySideAndIndex(placedOrders);
        const emptyLowerIndexes: number[] = [];
        for (let lowerIndex = 0; lowerIndex < grid.orderCount - 1; lowerIndex++) {
            if (this.getPairOrders(placedByKey, lowerIndex).length > 0) {
                this.backoffByPairKey.delete(this.getPairKey(grid.id, lowerIndex));
            } else {
                emptyLowerIndexes.push(lowerIndex);
            }
        }
        if (emptyLowerIndexes.length === 0) return 0;

        const orders = await this.grids.findOrdersByGridId(grid.id);
        const ordersByKey = this.groupBySideAndIndex(orders);
        const activeOrders = orders.filter((o) => ACTIVE_STATUSES.has(o.status));
        const openOrderIds = new Set(exchangeOpenOrders.map((o) => o.cloid?.toOrderId()));

        let placed = 0;
        for (const lowerIndex of emptyLowerIndexes) {
            const pairKey = this.getPairKey(grid.id, lowerIndex);
            const pairOrders = this.getPairOrders(ordersByKey, lowerIndex);
            if (pairOrders.some((o) => ACTIVE_STATUSES.has(o.status))) {
                this.backoffByPairKey.delete(pairKey);
                continue;
            }

            const params = await this.resolveMissingOrder(
                grid,
                pairOrders,
                openOrderIds,
                lowerIndex,
                now,
                accountAddress,
            );
            if (!params || !this.isReadyToPlace(grid, params, pairKey, activeOrders, now)) continue;

            if (!(await this.isGridRunning(grid.id))) {
                this.logger.info({ gridId: grid.id }, 'Empty level repair aborted: grid stopped');
                this.forgetGrid(grid.id);
                break;
            }

            if (await this.placeMissingOrder(grid, params, pairKey, activeOrders, accountAddress)) {
                placed++;
            }
        }
        return placed;
    }

    private async resolveMissingOrder(
        grid: GridDto,
        pairOrders: OrderDto[],
        openOrderIds: Set<string | undefined>,
        lowerIndex: number,
        now: number,
        accountAddress: string,
    ): Promise<RefillParams | null> {
        if (pairOrders.length === 0) return null;

        const openOrder = pairOrders.find((o) => openOrderIds.has(o.id));
        if (openOrder) {
            this.logger.warn(
                { gridId: grid.id, orderId: openOrder.id, status: openOrder.status, lowerIndex },
                'Empty level pair skipped: an order of the pair is still open on the exchange',
            );
            return null;
        }

        const latest = pairOrders.reduce((a, b) =>
            this.getLastActivityAt(b) > this.getLastActivityAt(a) ? b : a,
        );
        if (now - this.getLastActivityAt(latest) < this.intervalMs) return null;

        if (latest.status === OrderStatus.Filled) return RefillParams.calc(latest, grid);

        if (REPLACEABLE_STATUSES.has(latest.status) && latest.price !== null) {
            if (!latest.exchangeOrderId && (await this.isLiveOnExchange(latest, accountAddress))) {
                return null;
            }

            return new RefillParams(
                latest.side,
                latest.orderIndex,
                Price.from(latest.price),
                Decimal.from(latest.amount),
            );
        }

        this.logger.debug(
            { gridId: grid.id, orderId: latest.id, status: latest.status, lowerIndex },
            'Empty level pair skipped: latest order is not repairable',
        );
        return null;
    }

    private isReadyToPlace(
        grid: GridDto,
        params: RefillParams,
        pairKey: string,
        activeOrders: OrderDto[],
        now: number,
    ): boolean {
        const backoff = this.backoffByPairKey.get(pairKey);
        if (backoff && now < backoff.nextAttemptAt) return false;

        const crossingOrder = params.findCrossingOrder(activeOrders);
        if (!crossingOrder) return true;

        this.logger.warn(
            {
                gridId: grid.id,
                orderIndex: params.orderIndex,
                side: params.side,
                crossingOrderId: crossingOrder.id,
            },
            'Empty level repair postponed: order would cross an active order of the grid',
        );
        this.registerFailedAttempt(pairKey, now);
        return false;
    }

    private async placeMissingOrder(
        grid: GridDto,
        params: RefillParams,
        pairKey: string,
        activeOrders: OrderDto[],
        accountAddress: string,
    ): Promise<boolean> {
        const logContext = {
            gridId: grid.id,
            orderIndex: params.orderIndex,
            side: params.side,
            price: params.price.toNumber(),
        };

        try {
            const result = await this.refillPlacement.placeRefillOrder(
                grid,
                params,
                accountAddress,
            );

            if (result.success) {
                this.backoffByPairKey.delete(pairKey);
                if (result.order && !result.immediatelyFilled) activeOrders.push(result.order);
                this.logger.info(logContext, 'Empty level pair repaired');
                return true;
            }

            this.logger.warn(
                { ...logContext, error: result.error },
                'Empty level repair failed to place order',
            );
        } catch (err) {
            this.logger.warn({ ...logContext, err }, 'Empty level repair error');
        }

        this.registerFailedAttempt(pairKey, Date.now());
        return false;
    }

    /**
     * A placement the exchange accepted can still end up Failed locally (an HTTP timeout, see
     * RefillOrderPlacementService.cleanupPendingOrder). Such an order has no exchangeOrderId, and
     * once it fills it is gone from the open orders too — only its cloid can reveal it. An order
     * whose fate cannot be read is treated as live: re-placing it would double the level's capital.
     */
    private async isLiveOnExchange(order: OrderDto, accountAddress: string): Promise<boolean> {
        const cloid = ExchangeCloid.create(order.id).toString();

        try {
            const info = await this.exchange.getOrderStatus(accountAddress, cloid);
            if (!info || !LIVE_EXCHANGE_STATUSES.has(info.status)) return false;

            this.logger.warn(
                { gridId: order.gridId, orderId: order.id, exchangeStatus: info.status },
                'Empty level pair skipped: the order exists on the exchange despite its DB status',
            );
        } catch (err) {
            this.logger.warn(
                { err, gridId: order.gridId, orderId: order.id },
                'Empty level pair skipped: order status lookup by cloid failed',
            );
        }

        return true;
    }

    private async isGridRunning(gridId: string): Promise<boolean> {
        const grid = await this.grids.findGridById(gridId);
        return grid?.status === GridStatus.Running;
    }

    private registerFailedAttempt(pairKey: string, now: number): void {
        const attempts = (this.backoffByPairKey.get(pairKey)?.attempts ?? 0) + 1;
        const delayMs = Math.min(this.intervalMs * 2 ** attempts, this.maxBackoffMs);
        this.backoffByPairKey.set(pairKey, { attempts, nextAttemptAt: now + delayMs });
    }

    private forgetGrid(gridId: string): void {
        this.lastCheckAtByGridId.delete(gridId);
        for (const pairKey of this.backoffByPairKey.keys()) {
            if (pairKey.startsWith(`${gridId}:`)) this.backoffByPairKey.delete(pairKey);
        }
    }

    private groupBySideAndIndex(orders: OrderDto[]): Map<string, OrderDto[]> {
        const ordersByKey = new Map<string, OrderDto[]>();
        for (const order of orders) {
            const key = `${order.side}:${order.orderIndex}`;
            ordersByKey.set(key, [...(ordersByKey.get(key) ?? []), order]);
        }
        return ordersByKey;
    }

    private getPairOrders(ordersByKey: Map<string, OrderDto[]>, lowerIndex: number): OrderDto[] {
        return [
            ...(ordersByKey.get(`${OrderSide.Buy}:${lowerIndex}`) ?? []),
            ...(ordersByKey.get(`${OrderSide.Sell}:${lowerIndex + 1}`) ?? []),
        ];
    }

    private getPairKey(gridId: string, lowerIndex: number): string {
        return `${gridId}:${lowerIndex}`;
    }

    private getLastActivityAt(order: OrderDto): number {
        return Math.max(
            order.createdAt,
            order.placedAt ?? 0,
            order.filledAt ?? 0,
            order.cancelledAt ?? 0,
        );
    }
}
