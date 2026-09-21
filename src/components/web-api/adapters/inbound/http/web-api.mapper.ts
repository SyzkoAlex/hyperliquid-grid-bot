import { UserStatus } from '@domain/models/user/user-status';
import { UserDto } from '@components/users/api/dto/user.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { GridSnapshotDto } from '@components/grids/api/dto/grid-snapshot.dto';
import { WebUserDto } from './dto/web-user.dto';
import { WebGridDto } from './dto/web-grid.dto';
import { WebGridDetailDto } from './dto/web-grid-detail.dto';
import { WebOrderDto } from './dto/web-order.dto';

/** Maps internal DTOs to web responses field by field, so no internal or secret field can leak. */
export class WebApiMapper {
    static toWebUser(user: UserDto): WebUserDto {
        return {
            telegramId: user.telegramChatId,
            status: user.status,
            accountAddress: user.accountAddress,
            isConnected: user.status === UserStatus.Active,
        };
    }

    static toWebGrid(snapshot: GridSnapshotDto): WebGridDto {
        const { grid, pnl, orderStats } = snapshot;
        return {
            id: grid.id,
            symbol: grid.symbol,
            status: grid.status,
            lowerPrice: grid.lowerPrice,
            upperPrice: grid.upperPrice,
            orderCount: grid.orderCount,
            investmentUSDC: grid.investmentUSDC,
            investmentBase: grid.investmentBase,
            creationPrice: grid.creationPrice,
            createdAt: grid.createdAt,
            startedAt: grid.startedAt,
            stoppedAt: grid.stoppedAt,
            stopPrice: grid.stopPrice,
            stopLossEnabled: grid.stopLossEnabled,
            stopLossPrice: grid.stopLossPrice,
            stopLossTriggeredAt: grid.stopLossTriggeredAt,
            currentPrice: snapshot.currentPrice,
            pnl: {
                gridProfit: pnl.gridProfit,
                unrealizedPnl: pnl.unrealizedPnl,
                totalFees: pnl.totalFees,
            },
            orderStats: {
                activeBuys: orderStats.activeBuys,
                activeSells: orderStats.activeSells,
                avgActiveBuyPrice: orderStats.avgActiveBuyPrice,
                avgActiveSellPrice: orderStats.avgActiveSellPrice,
                lowestActiveBuyPrice: orderStats.lowestActiveBuyPrice,
                highestActiveSellPrice: orderStats.highestActiveSellPrice,
                filledCycles: orderStats.filledCycles,
            },
        };
    }

    static toWebGridDetail(snapshot: GridSnapshotDto): WebGridDetailDto {
        return {
            ...WebApiMapper.toWebGrid(snapshot),
            activeOrders: snapshot.activeOrders.map((o) => WebApiMapper.toWebOrder(o)),
            filledOrders: snapshot.filledOrders.map((o) => WebApiMapper.toWebOrder(o)),
        };
    }

    static toWebOrder(order: OrderDto): WebOrderDto {
        return {
            id: order.id,
            side: order.side,
            status: order.status,
            orderIndex: order.orderIndex,
            price: order.price,
            amount: order.amount,
            createdAt: order.createdAt,
            placedAt: order.placedAt,
            filledAt: order.filledAt,
            feeUsdc: order.feeUsdc,
        };
    }
}
