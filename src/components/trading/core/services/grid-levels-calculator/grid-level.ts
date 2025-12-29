import { Price } from '../../domain/common/price';
import { OrderSide } from '../../domain/order/order-side';

export interface GridLevel {
    index: number;
    price: Price;
    side: OrderSide;
    amountUSDC?: number;
    amountBase?: number;
}
