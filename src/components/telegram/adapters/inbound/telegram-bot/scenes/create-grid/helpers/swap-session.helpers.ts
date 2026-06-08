import { OptimalSwapDto } from '@components/trading/api/dto/optimal-swap.dto';
import { CreateGridWizardState } from '../create-grid-wizard-state';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';

/**
 * Stores or clears the swap offer in wizard session state.
 * Returns `true` when an offer was stored (used to toggle the swap button).
 */
export function persistSwapOffer(
    state: CreateGridWizardState,
    swapOffer: OptimalSwapDto | null | undefined,
): boolean {
    if (swapOffer) {
        state.swapOffer = swapOffer;
        return true;
    }
    delete state.swapOffer;
    return false;
}

/**
 * Waits for the exchange balance endpoint to settle after a swap fill.
 * The endpoint can lag behind IOC fill settlement by ~1 s; calling this
 * before re-fetching balances ensures the investment screen reflects the
 * post-swap state.
 *
 * Only waits when `swapFeedback` is truthy (i.e. the user just completed
 * a swap and was redirected back to the investment step).
 */
export async function awaitSwapBalanceSettle(swapFeedback: string | undefined): Promise<void> {
    if (swapFeedback) {
        await new Promise<void>((resolve) =>
            setTimeout(resolve, WIZARD_CONFIG.SWAP_BALANCE_SETTLE_DELAY_MS),
        );
    }
}
