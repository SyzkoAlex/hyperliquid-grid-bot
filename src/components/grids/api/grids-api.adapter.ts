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
import { GridsApiMapper } from './grids-api.mapper';
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
        return GridsApiMapper.toGridDto(grid);
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
        return grid ? GridsApiMapper.toGridDto(grid) : null;
    }

    async findActiveGrids(): Promise<GridDto[]> {
        const grids = await this.gridRepo.findManyActive();
        return grids.map((g) => GridsApiMapper.toGridDto(g));
    }

    async findGridsPaged(filter: {
        status?: GridStatus;
        page: number;
        pageSize: number;
    }): Promise<{ items: GridDto[]; totalCount: number; currentPage: number }> {
        const { status, page, pageSize } = filter;
        const totalCount = await this.gridRepo.countByStatus(status);
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        const currentPage = Math.min(Math.max(1, page), totalPages);
        const offset = (currentPage - 1) * pageSize;
        const gridList = await this.gridRepo.findManyByStatusPaged(status, offset, pageSize);
        return { items: gridList.map((g) => GridsApiMapper.toGridDto(g)), totalCount, currentPage };
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
        return GridsApiMapper.toOrderDto(order);
    }

    updateOrderStatus(orderId: string, status: OrderStatus, filledAt?: Date): Promise<void> {
        return this.orderRepo.updateStatus(orderId, status, filledAt);
    }

    updateOrderFee(orderId: string, feeUsdc: number): Promise<void> {
        return this.orderRepo.updateFee(orderId, feeUsdc.toString());
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
        return orders.map((o) => GridsApiMapper.toOrderDto(o));
    }

    async findOrdersByGridId(gridId: string): Promise<OrderDto[]> {
        const orders = await this.orderRepo.findManyByGridId(GridId.from(gridId));
        return orders.map((o) => GridsApiMapper.toOrderDto(o));
    }

    async findOrderByExchangeId(exchangeOrderId: string): Promise<OrderDto | null> {
        const order = await this.orderRepo.findOneByExchangeOrderId(exchangeOrderId);
        return order ? GridsApiMapper.toOrderDto(order) : null;
    }

    async findOrdersByStatus(status: OrderStatus): Promise<OrderDto[]> {
        const orders = await this.orderRepo.findManyByStatus(status);
        return orders.map((o) => GridsApiMapper.toOrderDto(o));
    }

    async findOrdersByGridIds(gridIds: string[]): Promise<OrderDto[]> {
        const orders = await this.orderRepo.findManyByGridIds(gridIds);
        return orders.map((o) => GridsApiMapper.toOrderDto(o));
    }

    async findPlacedOrdersByGridIds(gridIds: string[]): Promise<OrderDto[]> {
        const orders = await this.orderRepo.findManyPlacedByGridIds(gridIds);
        return orders.map((o) => GridsApiMapper.toOrderDto(o));
    }
}
