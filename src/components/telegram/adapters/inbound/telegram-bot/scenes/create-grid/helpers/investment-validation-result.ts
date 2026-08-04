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
    /** Price the swap offer was computed against — persist alongside swapOffer so
     *  later steps (e.g. SwapStep) format amounts with the same price, not a stale one. */
    swapOfferPrice?: number | null;
}
