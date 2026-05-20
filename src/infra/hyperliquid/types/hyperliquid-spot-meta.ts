export interface SpotMeta {
    tokens: Array<{
        name: string;
        index: number;
        szDecimals: number;
        fullName: string | null;
        isCanonical: boolean;
    }>;
    universe: Array<{
        name: string;
        tokens: number[];
        index: number;
        isCanonical: boolean;
    }>;
}
