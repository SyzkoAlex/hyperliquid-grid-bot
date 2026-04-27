import { Grouping } from './grouping';
import { OrderWirePayload } from './order-wire';

/**
 * /exchange action envelope for orders.
 * Field names: `type` discriminator, `orders` (array of wire payloads),
 * `grouping` (execution grouping — `'na'` for plain limit orders).
 */
export interface OrderActionPayload {
    type: 'order';
    orders: OrderWirePayload[];
    grouping: Grouping;
}

export class OrderAction {
    private constructor() {}

    static create(
        orders: OrderWirePayload[],
        grouping: Grouping = Grouping.Na,
    ): OrderActionPayload {
        return { type: 'order', orders, grouping };
    }
}
