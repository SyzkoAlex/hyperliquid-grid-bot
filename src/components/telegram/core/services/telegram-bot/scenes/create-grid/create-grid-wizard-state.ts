import { CreateGridMode } from './create-grid-mode';

export interface CreateGridWizardState {
    symbol?: string;
    mode?: CreateGridMode;
    upperPrice?: number;
    lowerPrice?: number;
    levels?: number;
    totalInvestmentUSDC?: number;
    messageIds?: number[];
}
