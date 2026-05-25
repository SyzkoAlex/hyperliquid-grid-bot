import { CreateGridMode } from './create-grid-mode';
import { SceneStep } from './create-grid-scene-step';
import { BalanceSnapshot } from './balance-snapshot';

export interface CreateGridWizardState {
    symbol?: string;
    currentPrice?: number;
    mode?: CreateGridMode;
    upperPrice?: number;
    lowerPrice?: number;
    levels?: number;
    totalInvestmentUSDC?: number;
    currentStep?: SceneStep;
    stepHistory?: SceneStep[];
    boardChatId?: number;
    boardMessageId?: number;
    pendingError?: string;
    balanceSnapshot?: BalanceSnapshot;
    stopLossEnabled?: boolean;
    stopLossPrice?: number;
}
