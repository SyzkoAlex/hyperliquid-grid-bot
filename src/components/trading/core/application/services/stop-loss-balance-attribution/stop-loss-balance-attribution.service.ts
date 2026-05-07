import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
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
     * Computes how much of the on-account base balance belongs to this grid.
     *
     * Grid-attributable base = initialBaseAmount + filled_buy_qty - filled_sell_qty.
     * Clamped to the actual on-account balance so we never try to sell tokens
     * that belong to another grid or were deposited separately.
     */
    async computeSellAmount(
        gridId: string,
        grid: GridDto,
        accountAddress: string,
        symbol: TradingSymbol,
    ): Promise<Decimal> {
        const userState = await this.exchange.getUserSpotState(accountAddress);
        const { baseBalance } = this.userBalanceExtractor.extractBalances(
            userState,
            symbol.toString(),
        );

        return this.computeGridAttributableBase(gridId, grid, baseBalance);
    }

    private async computeGridAttributableBase(
        gridId: string,
        grid: GridDto,
        baseBalance: Decimal,
    ): Promise<Decimal> {
        const initialBase = Decimal.from(grid.investmentBase);

        const allOrders = await this.grids.findOrdersByGridId(gridId);
        const filledOrders = allOrders.filter((o) => o.status === OrderStatus.Filled);

        const filledBuyQty = filledOrders
            .filter((o) => o.side === OrderSide.Buy)
            .reduce((sum, o) => sum + o.amount, 0);

        const filledSellQty = filledOrders
            .filter((o) => o.side === OrderSide.Sell)
            .reduce((sum, o) => sum + o.amount, 0);

        const computed = Decimal.from(initialBase.toNumber() + filledBuyQty - filledSellQty);

        // Never exceed what is actually on the account.
        const clamped = computed.gt(baseBalance) ? baseBalance : computed;

        // Guard against negative (e.g. data inconsistency).
        const result = clamped.lte(Decimal.zero()) ? Decimal.zero() : clamped;

        this.logger.debug(
            {
                gridId,
                initialBase: initialBase.toNumber(),
                filledBuyQty,
                filledSellQty,
                baseBalance: baseBalance.toNumber(),
                result: result.toNumber(),
            },
            'Computed grid-attributable base balance',
        );

        return result;
    }
}
