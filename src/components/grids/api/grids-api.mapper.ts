import { Grid } from '../core/domain/models/grid/grid';
import { Order } from '../core/domain/models/order/order';
import { GridDto } from './dto/grid.dto';
import { OrderDto } from './dto/order.dto';

export class GridsApiMapper {
    static toGridDto(grid: Grid): GridDto {
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
            creationPrice: grid.creationPrice?.toNumber(),
            trailingEnabled: grid.trailingEnabled,
            trailingTriggerPercent: grid.trailingTriggerPercent,
            trailingStepPercent: grid.trailingStepPercent,
            trailingPartialClosePercent: grid.trailingPartialClosePercent,
            createdAt: grid.createdAt.toDate().getTime(),
            startedAt: grid.startedAt?.toDate().getTime(),
            stoppedAt: grid.stoppedAt?.toDate().getTime(),
        };
    }

    static toOrderDto(order: Order): OrderDto {
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
            createdAt: order.createdAt.toDate().getTime(),
            placedAt: order.placedAt?.toDate().getTime(),
            filledAt: order.filledAt?.toDate().getTime(),
            feeUsdc: order.feeUsdc?.toNumber(),
        };
    }
}
