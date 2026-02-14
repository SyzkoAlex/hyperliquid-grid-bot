import { SceneStep } from '../create-grid-scene-step';

export interface StepCompleted {
    nextStep: SceneStep;
    confirmations?: string[];
}

export type StepResult = StepCompleted | null;
