export interface CancelSpotOrderInput {
    symbol: string;
    exchangeOrderId: number;
    agentPrivateKey: string;
    /** Master account address — required when signing with an agent wallet */
    accountAddress: string;
}
