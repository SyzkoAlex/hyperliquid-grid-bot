import { Decimal } from '@domain/models/primitives/decimal';

export interface CapitalDistribution {
    investmentUSDC: Decimal;
    investmentBase: Decimal;
}
