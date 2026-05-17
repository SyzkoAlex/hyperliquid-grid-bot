import { Decimal } from '@domain/models/primitives/decimal';

export interface CapitalDistribution {
    investmentUSDC: Decimal;
    investmentBase: Decimal;
    /** Base token balance required to cover all sell orders, with the sell-size buffer already applied. */
    requiredBaseBalance: Decimal;
}
