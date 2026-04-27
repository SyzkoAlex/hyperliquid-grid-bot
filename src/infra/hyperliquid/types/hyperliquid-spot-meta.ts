export interface SpotMeta {
    tokens: Array<{ name: string; index: number; szDecimals: number }>;
    universe: Array<{ tokens: number[]; index: number }>;
}
