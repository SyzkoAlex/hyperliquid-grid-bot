import { OrderSide } from '@domain/models/order/order-side';
import { OrderType } from '@domain/models/order/order-type';

export interface CreateOrderDto {
    id: string;
    gridId: string;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    levelIndex: number;
    price: number | null;
    amount: number;
}
