export interface OrderStatusUpdate {
    exchangeOrderId: number;
    coin: string;
    status: string;
    statusTimestamp: number;
}
