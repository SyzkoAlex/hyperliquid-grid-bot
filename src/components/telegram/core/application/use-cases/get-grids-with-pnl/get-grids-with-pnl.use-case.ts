import { Inject, Injectable } from '@nestjs/common';
import { GridStatus } from '@domain/models/grid/grid-status';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { GridFilter } from './grid-filter';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridSnapshotFactory } from '../../services/grid-snapshot-factory/grid-snapshot.factory';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';

export interface GridsPage {
    items: GridSnapshot[];
    totalCount: number;
    currentPage: number;
}

@Injectable()
export class GetGridsWithPnlUseCase {
    constructor(
        @Inject(GRIDS_API_PORT) private readonly gridsApi: GridsApiPort,
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
        private readonly snapshotFactory: GridSnapshotFactory,
    ) {}

    async execute(filter: GridFilter, page: number, pageSize: number): Promise<GridsPage> {
        const status = this.filterToStatus(filter);
        const {
            items: gridList,
            totalCount,
            currentPage,
        } = await this.gridsApi.findGridsPaged({ status, page, pageSize });
        const items = await this.enrichWithPnl(gridList);
        return { items, totalCount, currentPage };
    }

    private async enrichWithPnl(gridList: GridDto[]): Promise<GridSnapshot[]> {
        const gridIds = gridList.map((g) => g.id);
        const symbols = gridList.map((g) => g.symbol);
        const [allOrders, prices] = await Promise.all([
            this.gridsApi.findOrdersByGridIds(gridIds),
            this.tradingApi.getCurrentPrices(symbols),
        ]);
        const ordersByGridId = this.groupOrdersByGridId(allOrders);
        return gridList.map((grid, i) =>
            this.snapshotFactory.create(grid, ordersByGridId.get(grid.id) ?? [], prices[i]),
        );
    }

    private groupOrdersByGridId(orders: OrderDto[]): Map<string, OrderDto[]> {
        const map = new Map<string, OrderDto[]>();
        for (const order of orders) {
            const list = map.get(order.gridId) ?? [];
            list.push(order);
            map.set(order.gridId, list);
        }
        return map;
    }

    private filterToStatus(filter: GridFilter): GridStatus | undefined {
        switch (filter) {
            case GridFilter.Running:
                return GridStatus.Running;
            case GridFilter.Stopped:
                return GridStatus.Stopped;
            case GridFilter.All:
                return undefined;
        }
    }
}
