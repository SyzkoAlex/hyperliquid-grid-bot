export interface CapitalDistributionDto {
    investmentUSDC: number;
    investmentBase: number;
    /** Base token balance required to cover all sell orders, with the sell-size buffer already applied. */
    requiredBaseBalance: number;
}
