import { Order } from '@domain/models/order/order';
import { GridId } from '@domain/models/grid/grid-id';

export const TELEGRAM_ORDER_REPOSITORY_PORT = Symbol('TELEGRAM_ORDER_REPOSITORY_PORT');

export interface TelegramOrderRepositoryPort {
    findManyByGridId(gridId: GridId): Promise<Order[]>;
}
