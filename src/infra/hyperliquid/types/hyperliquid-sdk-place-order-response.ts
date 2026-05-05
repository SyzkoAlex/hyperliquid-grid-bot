export interface HyperliquidSdkPlaceOrderStatus {
    resting?: { oid: number };
    filled?: { oid: number; totalSz: string; avgPx: string };
    error?: string;
}

export interface HyperliquidSdkPlaceOrderResponse {
    status?: string;
    response?:
        | string
        | {
              data?: {
                  statuses?: HyperliquidSdkPlaceOrderStatus[];
              };
          };
}
