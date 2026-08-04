import { CreateGridMode } from './create-grid-mode';
import { SceneStep } from './create-grid-scene-step';
import { BalanceSnapshot } from './balance-snapshot';
import { OptimalSwapDto } from '@components/trading/api/dto/optimal-swap.dto';

export interface CreateGridWizardState {
    symbol?: string;
    currentPrice?: number;
    mode?: CreateGridMode;
    upperPrice?: number;
    lowerPrice?: number;
    orderCount?: number;
    totalInvestmentUSDC?: number;
    currentStep?: SceneStep;
    stepHistory?: SceneStep[];
    boardChatId?: number;
    boardMessageId?: number;
    pendingError?: string;
    balanceSnapshot?: BalanceSnapshot;
    stopLossEnabled?: boolean;
    stopLossPrice?: number;
    /** Filled by AdvancedInvestmentStep when a swap is offered; consumed by SwapStep. */
    swapOffer?: OptimalSwapDto;
    /** Price swapOffer was computed against; consumed by SwapStep to format amounts. */
    swapOfferPrice?: number;
    /** Mirror of `pendingError`, but for the Swap step's own validation/feedback. */
    swapFeedback?: string;
}
