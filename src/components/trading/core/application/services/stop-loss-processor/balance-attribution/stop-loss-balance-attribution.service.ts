import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { Decimal } from '@domain/models/primitives/decimal';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { UserBalanceExtractorService } from '@components/trading/core/domain/services/user-balance-extractor/user-balance-extractor.service';
import { GridDto } from '@components/grids/api/dto/grid.dto';

@Injectable()
export class StopLossBalanceAttributionService {
    private readonly logger = logger.child({ context: StopLossBalanceAttributionService.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        private readonly userBalanceExtractor: UserBalanceExtractorService,
    ) {}

    /**
     * Computes how much base to sell: initialBaseAmount + filled_buy_qty − filled_sell_qty,
     * clamped to the available on-account balance after reserving other same-symbol grids' base.
     */
    async computeSellAmount(
        grid: GridDto,
        accountAddress: string,
        otherActiveGrids: GridDto[] = [],
    ): Promise<Decimal> {
        const userState = await this.exchange.getUserSpotState(accountAddress);
        const { baseBalance } = this.userBalanceExtractor.extractBalances(userState, grid.symbol);

        const sameSymbolOtherGrids = otherActiveGrids.filter((g) => g.symbol === grid.symbol);

        let reservedByOthers = 0;
        if (sameSymbolOtherGrids.length > 0) {
            const reservations = await Promise.all(
                sameSymbolOtherGrids.map((g) => this.computeTheoreticalBase(g)),
            );
            reservedByOthers = reservations.reduce((sum, v) => sum + v, 0);
        }

        const availableBalance = Decimal.from(
            Math.max(0, baseBalance.toNumber() - reservedByOthers),
        );
        return this.computeGridAttributableBase(grid, availableBalance);
    }

    private async computeTheoreticalBase(grid: GridDto): Promise<number> {
        const initialBase = Decimal.from(grid.investmentBase).toNumber();
        const allOrders = await this.grids.findOrdersByGridId(grid.id);
        const filledOrders = allOrders.filter((o) => o.status === OrderStatus.Filled);
        const filledBuyQty = filledOrders
            .filter((o) => o.side === OrderSide.Buy)
            .reduce((sum, o) => sum + o.amount, 0);
        const filledSellQty = filledOrders
            .filter((o) => o.side === OrderSide.Sell)
            .reduce((sum, o) => sum + o.amount, 0);
        return Math.max(0, initialBase + filledBuyQty - filledSellQty);
    }

    private async computeGridAttributableBase(
        grid: GridDto,
        availableBalance: Decimal,
    ): Promise<Decimal> {
        const computed = Decimal.from(await this.computeTheoreticalBase(grid));

        // Never exceed what is actually available (account balance minus what other same-symbol grids need).
        const clamped = computed.gt(availableBalance) ? availableBalance : computed;

        // Guard against negative (e.g. data inconsistency).
        const result = clamped.lte(Decimal.zero()) ? Decimal.zero() : clamped;

        this.logger.debug(
            {
                gridId: grid.id,
                computed: computed.toNumber(),
                availableBalance: availableBalance.toNumber(),
                result: result.toNumber(),
            },
            'Computed grid-attributable base balance',
        );

        return result;
    }
}
