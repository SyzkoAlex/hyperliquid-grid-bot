import { Decimal } from '@domain/models/primitives/decimal';

export interface UserBalances {
    usdcBalance: Decimal;
    baseBalance: Decimal;
}
