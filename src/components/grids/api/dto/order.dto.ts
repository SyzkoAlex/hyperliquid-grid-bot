import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';

export interface OrderDto {
    id: string;
    gridId: string;
    symbol: string;
    side: OrderSide;
    status: OrderStatus;
    type: OrderType;
    levelIndex: number;
    price: number | null;
    amount: number;
    exchangeOrderId: string | null;
    createdAt: number;
    placedAt?: number;
    filledAt?: number;
}
