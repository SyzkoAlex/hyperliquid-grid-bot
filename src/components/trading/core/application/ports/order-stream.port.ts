export const ORDER_STREAM_PORT = Symbol('ORDER_STREAM_PORT');

export interface OrderStreamPort {
    subscribeOrderStreamForAccount(accountAddress: string): void;
}
