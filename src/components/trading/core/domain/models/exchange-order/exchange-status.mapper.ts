import { ExchangeOrderStatus } from './exchange-order-status';
import { OrderStatus } from '@domain/models/order/order-status';

/**
 * Exchange Status Mapper
 *
 * Maps exchange order statuses to internal OrderStatus enum values.
 * This mapper contains domain logic for interpreting exchange statuses.
 */
export class ExchangeStatusMapper {
    /**
     * Map exchange status to internal OrderStatus.
     *
     * Comprehensive mapping for all Hyperliquid order statuses:
     * - OPEN, TRIGGERED → Placed (order is active on exchange)
     * - FILLED → Filled (order completed)
     * - All CANCELED types → Cancelled (user or system cancelled)
     * - All REJECTED types → Failed (placement rejected)
     */
    static mapToOrderStatus(exchangeStatus: ExchangeOrderStatus): OrderStatus {
        switch (exchangeStatus) {
            // Active states
            case ExchangeOrderStatus.OPEN:
            case ExchangeOrderStatus.TRIGGERED:
                return OrderStatus.Placed;

            // Filled state
            case ExchangeOrderStatus.FILLED:
                return OrderStatus.Filled;

            // User cancellations
            case ExchangeOrderStatus.CANCELED:
                return OrderStatus.Cancelled;

            // System cancellations
            case ExchangeOrderStatus.MARGIN_CANCELED:
            case ExchangeOrderStatus.VAULT_WITHDRAWAL_CANCELED:
            case ExchangeOrderStatus.OPEN_INTEREST_CAP_CANCELED:
            case ExchangeOrderStatus.SELF_TRADE_CANCELED:
            case ExchangeOrderStatus.REDUCE_ONLY_CANCELED:
            case ExchangeOrderStatus.SIBLING_FILLED_CANCELED:
            case ExchangeOrderStatus.DELISTED_CANCELED:
            case ExchangeOrderStatus.LIQUIDATED_CANCELED:
            case ExchangeOrderStatus.SCHEDULED_CANCEL:
                return OrderStatus.Cancelled;

            // Rejections at placement
            case ExchangeOrderStatus.REJECTED:
            case ExchangeOrderStatus.TICK_REJECTED:
            case ExchangeOrderStatus.MIN_TRADE_NTL_REJECTED:
            case ExchangeOrderStatus.PERP_MARGIN_REJECTED:
            case ExchangeOrderStatus.REDUCE_ONLY_REJECTED:
            case ExchangeOrderStatus.BAD_ALO_PX_REJECTED:
            case ExchangeOrderStatus.IOC_CANCEL_REJECTED:
            case ExchangeOrderStatus.BAD_TRIGGER_PX_REJECTED:
            case ExchangeOrderStatus.MARKET_ORDER_NO_LIQUIDITY_REJECTED:
            case ExchangeOrderStatus.POSITION_INCREASE_AT_OPEN_INTEREST_CAP_REJECTED:
            case ExchangeOrderStatus.POSITION_FLIP_AT_OPEN_INTEREST_CAP_REJECTED:
            case ExchangeOrderStatus.TOO_AGGRESSIVE_AT_OPEN_INTEREST_CAP_REJECTED:
            case ExchangeOrderStatus.OPEN_INTEREST_INCREASE_REJECTED:
            case ExchangeOrderStatus.INSUFFICIENT_SPOT_BALANCE_REJECTED:
            case ExchangeOrderStatus.ORACLE_REJECTED:
            case ExchangeOrderStatus.PERP_MAX_POSITION_REJECTED:
                return OrderStatus.Failed;

            default: {
                // Exhaustiveness check - TypeScript will error if a case is missing
                const _exhaustiveCheck: never = exchangeStatus;
                throw new Error(`Unhandled exchange status: ${_exhaustiveCheck}`);
            }
        }
    }
}
