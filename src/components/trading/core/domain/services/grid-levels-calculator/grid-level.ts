import { Price } from '@domain/models/primitives/price';
import { OrderSide } from '@domain/models/order/order-side';

export interface GridLevel {
    index: number;
    price: Price;
    side: OrderSide;
    amountUSDC?: number;
    amountBase?: number;
}
