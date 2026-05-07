import { CreateGridMode } from './create-grid-mode';
import { SceneStep } from './create-grid-scene-step';

export interface StepMessages {
    enterMessageIds: number[];
    confirmationMessageIds: number[];
}

export interface CreateGridWizardState {
    symbol?: string;
    mode?: CreateGridMode;
    upperPrice?: number;
    lowerPrice?: number;
    levels?: number;
    totalInvestmentUSDC?: number;
    currentStep?: SceneStep;
    stepHistory?: SceneStep[];
    stepMessages?: Record<string, StepMessages>;
    messageIds?: number[];
    showingValidationError?: boolean;
    stopLossEnabled?: boolean;
    stopLossPrice?: number;
}
