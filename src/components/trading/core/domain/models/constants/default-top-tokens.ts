import { TokenDescriptor } from '@components/trading/core/domain/models/token/token-descriptor';

export const DEFAULT_TOP_TOKENS: ReadonlyArray<TokenDescriptor> = [
    { symbol: 'HYPE', displayName: 'HYPE' },
    { symbol: 'UBTC', displayName: 'BTC' },
    { symbol: 'UETH', displayName: 'ETH' },
    { symbol: 'USOL', displayName: 'SOL' },
];
