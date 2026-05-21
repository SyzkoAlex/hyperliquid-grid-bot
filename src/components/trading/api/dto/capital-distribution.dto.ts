export interface CapitalDistributionDto {
    requiredUSDC: number;
    /** Base token balance required to cover all sell orders, with the sell-size buffer
     *  and per-order ceil-rounding to szDecimals already applied. */
    requiredBase: number;
}
