import { Decimal } from '@domain/models/primitives/decimal';
import { OptimalSwapDto } from '@components/trading/api/dto/optimal-swap.dto';

interface ValidatedDistribution {
    requiredUSDC: Decimal;
    requiredBase: Decimal;
}

export interface InvestmentValidationResult {
    valid: boolean;
    errorMessage?: string;
    showBackButton?: boolean;
    distribution?: ValidatedDistribution;
    swapOffer?: OptimalSwapDto | null;
}
