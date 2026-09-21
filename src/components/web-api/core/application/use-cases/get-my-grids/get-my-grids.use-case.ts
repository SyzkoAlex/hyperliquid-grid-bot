import { Inject, Injectable } from '@nestjs/common';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { MyGridsPage } from './my-grids-page';

@Injectable()
export class GetMyGridsUseCase {
    constructor(
        @Inject(GRIDS_API_PORT) private readonly gridsApi: GridsApiPort,
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
    ) {}

    async execute(
        userId: string,
        status: GridStatus | undefined,
        page: number,
        pageSize: number,
    ): Promise<MyGridsPage> {
        const {
            items: gridList,
            totalCount,
            currentPage,
        } = await this.gridsApi.findGridsPagedForUser({ userId, status, page, pageSize });
        const prices = await this.tradingApi.getCurrentPrices(gridList.map((g) => g.symbol));
        const items = await this.gridsApi.buildGridSnapshots(gridList, prices);
        return { items, totalCount, currentPage };
    }
}
