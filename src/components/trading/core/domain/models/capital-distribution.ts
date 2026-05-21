import { Decimal } from '@domain/models/primitives/decimal';

export interface CapitalDistribution {
    /** USDC balance required to fund all buy orders. */
    requiredUSDC: Decimal;
    /** Base token balance required to fund all sell orders, with the sell-size buffer
     *  and per-order ceil-rounding to szDecimals already applied. */
    requiredBase: Decimal;
    /** Raw (un-buffered, un-rounded) base token allocation derived from capital and price.
     *  Internal value used for grid persistence; external API consumers receive only requiredBase. */
    rawInvestmentBase: Decimal;
}
