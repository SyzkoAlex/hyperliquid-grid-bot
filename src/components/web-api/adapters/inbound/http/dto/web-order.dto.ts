import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';

export interface WebOrderDto {
    id: string;
    side: OrderSide;
    status: OrderStatus;
    orderIndex: number;
    price: number | null;
    amount: number;
    createdAt: number;
    placedAt?: number;
    filledAt?: number;
    feeUsdc?: number;
}
