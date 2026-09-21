import { Inject, Injectable } from '@nestjs/common';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { GridSnapshotDto } from '@components/grids/api/dto/grid-snapshot.dto';

@Injectable()
export class GetMyGridUseCase {
    constructor(
        @Inject(GRIDS_API_PORT) private readonly gridsApi: GridsApiPort,
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
    ) {}

    async execute(userId: string, id: string): Promise<GridSnapshotDto | null> {
        const grid = await this.gridsApi.findGridByIdForUser(userId, id);
        if (!grid) return null;

        const [orders, currentPrice] = await Promise.all([
            this.gridsApi.findOrdersByGridId(grid.id),
            this.tradingApi.getCurrentPrice(grid.symbol),
        ]);

        return this.gridsApi.buildGridSnapshot(grid, orders, currentPrice);
    }
}
