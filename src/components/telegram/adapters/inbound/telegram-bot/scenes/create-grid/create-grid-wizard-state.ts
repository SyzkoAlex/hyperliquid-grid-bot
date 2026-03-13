import { CreateGridMode } from './create-grid-mode';
import { SceneStep } from './create-grid-scene-step';
import { GridMode } from '@domain/models/grid/grid-mode';

export interface StepMessages {
    enterMessageIds: number[];
    confirmationMessageIds: number[];
}

export interface CreateGridWizardState {
    symbol?: string;
    mode?: CreateGridMode;
    gridMode?: GridMode;
    upperPrice?: number;
    lowerPrice?: number;
    levels?: number;
    totalInvestmentUSDC?: number;
    currentStep?: SceneStep;
    stepHistory?: SceneStep[];
    stepMessages?: Record<string, StepMessages>;
    messageIds?: number[];
    showingValidationError?: boolean;
}
