import { Inject, Injectable } from '@nestjs/common';
import { Grid } from '../core/domain/models/grid/grid';
import { GridId } from '../core/domain/models/grid/grid-id';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Order } from '../core/domain/models/order/order';
import { OrderId } from '../core/domain/models/order/order-id';
import { OrderStatus } from '@domain/models/order/order-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import {
    GRID_REPOSITORY_PORT,
    GridRepositoryPort,
} from '../core/application/ports/grid-repository.port';
import {
    ORDER_REPOSITORY_PORT,
    OrderRepositoryPort,
} from '../core/application/ports/order-repository.port';
import { GridsApiPort } from './grids-api.port';
import { GridDto } from './dto/grid.dto';
import { OrderDto } from './dto/order.dto';
import { CreateGridDto } from './dto/create-grid.dto';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class GridsApiAdapter implements GridsApiPort {
    constructor(
        @Inject(GRID_REPOSITORY_PORT) private readonly gridRepo: GridRepositoryPort,
        @Inject(ORDER_REPOSITORY_PORT) private readonly orderRepo: OrderRepositoryPort,
    ) {}

    // ── Grids — write ──────────────────────────────────────────────

    async createGrid(dto: CreateGridDto): Promise<GridDto> {
        const grid = Grid.create({
            id: GridId.from(dto.id),
            symbol: TradingSymbol.create(dto.symbol),
            mode: dto.mode,
            lowerPrice: Price.from(dto.lowerPrice),
            upperPrice: Price.from(dto.upperPrice),
            levels: dto.levels,
            investmentUSDC: Decimal.from(dto.investmentUSDC),
            investmentBase: Decimal.from(dto.investmentBase),
            trailingEnabled: dto.trailingEnabled,
            trailingTriggerPercent: dto.trailingTriggerPercent,
            trailingStepPercent: dto.trailingStepPercent,
            trailingPartialClosePercent: dto.trailingPartialClosePercent,
        });
        await this.gridRepo.save(grid);
        return this.toGridDto(grid);
    }

    async updateGridStatus(id: string, status: GridStatus, _timestamp?: number): Promise<void> {
        const grid = await this.gridRepo.findOneById(GridId.from(id));
        if (!grid) throw new Error(`Grid not found: ${id}`);
        grid.transitionTo(status);
        await this.gridRepo.save(grid);
    }

    // ── Grids — read ───────────────────────────────────────────────

    async findGridById(id: string): Promise<GridDto | null> {
        const grid = await this.gridRepo.findOneById(GridId.from(id));
        return grid ? this.toGridDto(grid) : null;
    }

    async findActiveGrids(): Promise<GridDto[]> {
        const grids = await this.gridRepo.findManyActive();
        return grids.map((g) => this.toGridDto(g));
    }

    async findActiveGridsByIds(gridIds: string[]): Promise<GridDto[]> {
        const grids = await this.gridRepo.findManyActiveByIds(gridIds);
        return grids.map((g) => this.toGridDto(g));
    }

    async findGridsByStatus(status: GridStatus): Promise<GridDto[]> {
        const grids = await this.gridRepo.findManyByStatus(status);
        return grids.map((g) => this.toGridDto(g));
    }

    async findAllGrids(): Promise<GridDto[]> {
        const grids = await this.gridRepo.findAll();
        return grids.map((g) => this.toGridDto(g));
    }

    // ── Orders — write ─────────────────────────────────────────────

    async createOrder(dto: CreateOrderDto): Promise<OrderDto> {
        const order = Order.create({
            id: OrderId.from(dto.id),
            gridId: GridId.from(dto.gridId),
            symbol: TradingSymbol.create(dto.symbol),
            side: dto.side,
            type: dto.type,
            levelIndex: dto.levelIndex,
            price: dto.price !== null ? Price.from(dto.price) : undefined,
            amount: Decimal.from(dto.amount),
            status: OrderStatus.Pending,
        });
        await this.orderRepo.save(order);
        return this.toOrderDto(order);
    }

    updateOrderStatus(orderId: string, status: OrderStatus, filledAt?: Date): Promise<void> {
        return this.orderRepo.updateStatus(orderId, status, filledAt);
    }

    updateOrderExchangeId(
        orderId: string,
        exchangeOrderId: string,
        status: OrderStatus,
        placedAt: Date,
    ): Promise<void> {
        return this.orderRepo.updateExchangeOrderId(orderId, exchangeOrderId, status, placedAt);
    }

    // ── Orders — read ──────────────────────────────────────────────

    async findActiveOrdersByGridId(gridId: string): Promise<OrderDto[]> {
        const orders = await this.orderRepo.findManyActive(GridId.from(gridId));
        return orders.map((o) => this.toOrderDto(o));
    }

    async findOrdersByGridId(gridId: string): Promise<OrderDto[]> {
        const orders = await this.orderRepo.findManyByGridId(GridId.from(gridId));
        return orders.map((o) => this.toOrderDto(o));
    }

    async findOrderByExchangeId(exchangeOrderId: string): Promise<OrderDto | null> {
        const order = await this.orderRepo.findOneByExchangeOrderId(exchangeOrderId);
        return order ? this.toOrderDto(order) : null;
    }

    async findPendingOrdersByGridId(gridId: string): Promise<OrderDto[]> {
        const orders = await this.orderRepo.findManyPendingByGridId(gridId);
        return orders.map((o) => this.toOrderDto(o));
    }

    async findStalePendingOrders(olderThan: Date): Promise<OrderDto[]> {
        const orders = await this.orderRepo.findManyStalePending(olderThan);
        return orders.map((o) => this.toOrderDto(o));
    }

    async findOrdersByStatus(status: OrderStatus): Promise<OrderDto[]> {
        const orders = await this.orderRepo.findManyByStatus(status);
        return orders.map((o) => this.toOrderDto(o));
    }

    async findOrdersByIds(orderIds: string[]): Promise<OrderDto[]> {
        const orders = await this.orderRepo.findManyByIds(orderIds);
        return orders.map((o) => this.toOrderDto(o));
    }

    async findPlacedOrdersByGridIds(gridIds: string[]): Promise<OrderDto[]> {
        const orders = await this.orderRepo.findManyPlacedByGridIds(gridIds);
        return orders.map((o) => this.toOrderDto(o));
    }

    // ── Private mappers ────────────────────────────────────────────

    private toGridDto(grid: Grid): GridDto {
        return {
            id: grid.id.toString(),
            symbol: grid.symbol.toString(),
            mode: grid.mode,
            status: grid.status,
            lowerPrice: grid.lowerPrice.toNumber(),
            upperPrice: grid.upperPrice.toNumber(),
            levels: grid.levels,
            investmentUSDC: grid.investmentUSDC.toNumber(),
            investmentBase: grid.investmentBase.toNumber(),
            trailingEnabled: grid.trailingEnabled,
            trailingTriggerPercent: grid.trailingTriggerPercent,
            trailingStepPercent: grid.trailingStepPercent,
            trailingPartialClosePercent: grid.trailingPartialClosePercent,
            createdAt: grid.createdAt.toDate().getTime(),
            startedAt: grid.startedAt?.toDate().getTime(),
            stoppedAt: grid.stoppedAt?.toDate().getTime(),
        };
    }

    private toOrderDto(order: Order): OrderDto {
        return {
            id: order.id.toString(),
            gridId: order.gridId.toString(),
            symbol: order.symbol.toString(),
            side: order.side,
            status: order.status,
            type: order.type,
            levelIndex: order.levelIndex,
            price: order.price?.toNumber() ?? null,
            amount: order.amount.toNumber(),
            exchangeOrderId: order.exchangeOrderId,
            placedAt: order.placedAt?.toDate().getTime(),
            filledAt: order.filledAt?.toDate().getTime(),
        };
    }
}
