import { OrderDto } from '@components/grids/api/dto/order.dto';

export class PlaceRefillOrderResult {
    constructor(
        public success: boolean,
        public order?: OrderDto,
        public error?: string,
    ) {}

    static failure(error: string): PlaceRefillOrderResult {
        return new PlaceRefillOrderResult(false, undefined, error);
    }

    static success(order: OrderDto): PlaceRefillOrderResult {
        return new PlaceRefillOrderResult(true, order);
    }
}
