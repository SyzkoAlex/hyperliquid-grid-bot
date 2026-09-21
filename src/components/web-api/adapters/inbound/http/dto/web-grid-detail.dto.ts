import { WebGridDto } from './web-grid.dto';
import { WebOrderDto } from './web-order.dto';

export interface WebGridDetailDto extends WebGridDto {
    activeOrders: WebOrderDto[];
    filledOrders: WebOrderDto[];
}
