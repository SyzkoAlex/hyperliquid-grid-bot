export type HyperliquidOrderStatusResponse =
    | HyperliquidOrderStatusFound
    | HyperliquidOrderStatusUnknown;

export interface HyperliquidOrderStatusFound {
    status: 'order';
    order: {
        order: {
            coin: string;
            side: string;
            limitPx: string;
            sz: string;
            oid: number;
            timestamp: number;
            origSz: string;
            cloid?: string | null;
        };
        status: string;
        statusTimestamp: number;
    };
}

export interface HyperliquidOrderStatusUnknown {
    status: 'unknownOid';
}
