export interface PlaceSpotOrderInput {
    /** Plain symbol, e.g. "ETH" */
    symbol: string;
    isBuy: boolean;
    /** Raw float, rounding handled internally */
    amount: number;
    price: number;
    /** Optional pre-computed hex CLOID "0x..." */
    cloid?: string;
    agentPrivateKey: string;
}
