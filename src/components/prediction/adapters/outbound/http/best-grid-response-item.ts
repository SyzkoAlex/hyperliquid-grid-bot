/** Raw /suggest wire shape (all money values are decimal strings). */
export interface BestGridResponseItem {
    pair: string;
    base_asset: string;
    conservative_pnl_usdc: string | null;
    summary: string;
    recommended_config: {
        lower: string;
        upper: string;
        n_levels: number;
        initial_capital: string;
    } | null;
    details: {
        warnings: string[];
        period_days: number;
        [key: string]: unknown;
    };
}
