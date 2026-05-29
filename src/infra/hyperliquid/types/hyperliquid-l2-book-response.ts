import { HyperliquidL2BookLevel } from './hyperliquid-l2-book-level';

export interface HyperliquidL2BookResponse {
    coin: string;
    time: number;
    levels: [HyperliquidL2BookLevel[], HyperliquidL2BookLevel[]];
}
