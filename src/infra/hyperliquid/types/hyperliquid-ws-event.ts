export interface HyperliquidWsOrderStatus {
    order: {
        coin: string;
        oid: number;
        side: 'B' | 'A';
        limitPx: string;
        sz: string;
        timestamp: number;
    };
    status: string;
    statusTimestamp: number;
}

export interface HyperliquidWsEvent {
    channel: string;
    data: HyperliquidWsOrderStatus[];
}
