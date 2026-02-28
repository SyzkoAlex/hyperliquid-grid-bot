export interface TokenBalance {
    symbol: string;
    available: number;
    inOrders: number;
    total: number;
    price: number;
    valueUsdc: number;
}

export interface UserBalance {
    usdc: { available: number; inOrders: number; total: number };
    tokens: TokenBalance[];
    totalValueUsdc: number;
}
