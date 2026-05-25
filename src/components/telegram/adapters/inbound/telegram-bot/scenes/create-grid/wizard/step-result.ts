import { SceneStep } from '../create-grid-scene-step';

export interface StepCompleted {
    nextStep: SceneStep;
}

export type StepResult = StepCompleted | null;
