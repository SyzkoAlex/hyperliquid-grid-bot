import { Decimal } from '@domain/models/primitives/decimal';

export interface StopLossMarketSellParams {
    gridId: string;
    symbol: string;
    amount: Decimal;
    currentMid: number;
    accountAddress: string;
}
