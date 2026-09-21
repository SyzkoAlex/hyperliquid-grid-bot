import { Inject, Injectable } from '@nestjs/common';
import { GridStatus } from '@domain/models/grid/grid-status';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { GridFilter } from './grid-filter';
import { GridSnapshotDto } from '@components/grids/api/dto/grid-snapshot.dto';

export interface GridsPage {
    items: GridSnapshotDto[];
    totalCount: number;
    currentPage: number;
}

@Injectable()
export class GetGridsWithPnlUseCase {
    constructor(
        @Inject(GRIDS_API_PORT) private readonly gridsApi: GridsApiPort,
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
    ) {}

    async execute(
        userId: string,
        filter: GridFilter,
        page: number,
        pageSize: number,
    ): Promise<GridsPage> {
        const status = this.filterToStatus(filter);
        const {
            items: gridList,
            totalCount,
            currentPage,
        } = await this.gridsApi.findGridsPagedForUser({ userId, status, page, pageSize });
        const prices = await this.tradingApi.getCurrentPrices(gridList.map((g) => g.symbol));
        const items = await this.gridsApi.buildGridSnapshots(gridList, prices);
        return { items, totalCount, currentPage };
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
