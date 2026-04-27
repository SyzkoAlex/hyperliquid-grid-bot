import { Injectable } from '@nestjs/common';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';
import { OrderStatus } from '@domain/models/order/order-status';
import { ExchangePlaceOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-result';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { ExchangeOrderInfo } from '@components/trading/core/domain/models/exchange-order/exchange-order-info';
import { ExchangeOrderFill } from '@components/trading/core/domain/models/exchange-order/exchange-order-fill';
import { ExchangeOrderStatus } from '@components/trading/core/domain/models/exchange-order/exchange-order-status';
import { ExchangeCloid } from '@components/trading/core/domain/models/exchange-order/exchange-cloid';
import { UserState } from '@components/trading/core/domain/models/user-state/user-state';
import { AssetPosition } from '@components/trading/core/domain/models/user-state/asset-position';
import { HyperliquidOpenOrder } from '@/infra/hyperliquid/types/hyperliquid-open-order';
import { HyperliquidOrderStatusFound } from '@/infra/hyperliquid/types/hyperliquid-order-status-response';
import { HyperliquidSdkPlaceOrderResponse } from '@/infra/hyperliquid/types/hyperliquid-sdk-place-order-response';
import { HyperliquidUserStateResponse } from '@/infra/hyperliquid/types/hyperliquid-user-state-response';
import { UserFills } from '@/infra/hyperliquid/types/user-fills';

type SymbolResolver = (coin: string) => string;

/**
 * Pure mapper — no I/O dependencies.
 * External data (szDecimals, symbol resolver) is passed as parameters.
 */
@Injectable()
export class HyperliquidExchangeMapper {
    toExchangePlaceOrderResult(
        response: HyperliquidSdkPlaceOrderResponse,
    ): ExchangePlaceOrderResult {
        const firstStatus = response?.response?.data?.statuses?.[0];

        if (firstStatus?.error) {
            return {
                exchangeOrderId: '',
                status: OrderStatus.Failed,
                error: firstStatus.error,
            };
        }

        const exchangeOrderId =
            firstStatus?.resting?.oid?.toString() || firstStatus?.filled?.oid?.toString();

        if (!exchangeOrderId) {
            return {
                exchangeOrderId: '',
                status: OrderStatus.Failed,
                error: 'No order ID in response',
            };
        }

        if (firstStatus?.filled) {
            return { exchangeOrderId, status: OrderStatus.Filled };
        }

        return { exchangeOrderId, status: OrderStatus.Placed };
    }

    toOpenOrders(
        apiOrders: HyperliquidOpenOrder[],
        resolveSymbol: SymbolResolver,
    ): ExchangeOpenOrder[] {
        return apiOrders.map((order) => this.toOpenOrder(order, resolveSymbol));
    }

    toOpenOrder(apiOrder: HyperliquidOpenOrder, resolveSymbol: SymbolResolver): ExchangeOpenOrder {
        const resolvedCoin = resolveSymbol(apiOrder.coin);
        const symbol = TradingSymbol.create(resolvedCoin);
        const side: OrderSide = apiOrder.side === 'B' ? OrderSide.Buy : OrderSide.Sell;
        const price = Price.from(parseFloat(apiOrder.limitPx));
        const amount = Decimal.from(apiOrder.sz);
        const origAmount = Decimal.from(apiOrder.origSz ?? apiOrder.sz);
        const filledAmount = origAmount.sub(amount);
        const cloid = apiOrder.cloid ? ExchangeCloid.fromString(apiOrder.cloid) : undefined;

        return {
            id: apiOrder.oid.toString(),
            cloid,
            symbol,
            type: OrderType.Limit,
            side,
            price,
            amount: origAmount,
            filledAmount,
            status: ExchangeOrderStatus.OPEN,
            reduceOnly: apiOrder.reduceOnly ?? false,
            placedAt: apiOrder.timestamp,
        };
    }

    toExchangeOrderFills(fills: UserFills, oid: number): ExchangeOrderFill[] {
        return fills
            .filter((f) => f.oid === oid)
            .map((f) => ({
                oid: f.oid,
                feeUsdc: parseFloat(f.fee),
                time: f.time,
            }));
    }

    toExchangeOrderInfo(input: HyperliquidOrderStatusFound): ExchangeOrderInfo {
        return {
            exchangeOrderId: input.order.order.oid.toString(),
            status: input.order.status as ExchangeOrderStatus,
            statusTimestamp: input.order.statusTimestamp,
        };
    }

    toUserState(response: HyperliquidUserStateResponse): UserState {
        const usdc = this.findUsdcBalance(response.balances);
        const assetPositions = response.balances
            .filter((b) => b.coin !== 'USDC')
            .map((b) => this.toAssetPosition(b));

        return UserState.create({
            withdrawableBalance: usdc.available,
            usdcTotal: usdc.total,
            usdcHold: usdc.hold,
            assetPositions,
        });
    }

    private findUsdcBalance(balances: HyperliquidUserStateResponse['balances']): {
        available: Decimal;
        total: Decimal;
        hold: Decimal;
    } {
        const usdcBalance = balances.find((b) => b.coin === 'USDC');
        if (!usdcBalance) {
            return { available: Decimal.zero(), total: Decimal.zero(), hold: Decimal.zero() };
        }

        const total = Decimal.from(parseFloat(usdcBalance.total || '0'));
        const hold = Decimal.from(parseFloat(usdcBalance.hold || '0'));
        return { available: total.sub(hold), total, hold };
    }

    private toAssetPosition(
        balance: HyperliquidUserStateResponse['balances'][number],
    ): AssetPosition {
        const symbol = TradingSymbol.create(balance.coin);
        const total = Decimal.from(parseFloat(balance.total || '0'));
        const hold = Decimal.from(parseFloat(balance.hold || '0'));
        const available = total.sub(hold);

        return AssetPosition.create({ symbol, size: available, total, hold });
    }
}
