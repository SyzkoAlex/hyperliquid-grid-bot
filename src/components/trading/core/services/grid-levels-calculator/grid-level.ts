import { Price } from '@domain/primitives/price';
import { OrderSide } from '@domain/order/order-side';

export interface GridLevel {
    index: number;
    price: Price;
    side: OrderSide;
    amountUSDC?: number;
    amountBase?: number;
}
