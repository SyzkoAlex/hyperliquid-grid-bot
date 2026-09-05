import { CreateGridMode } from '../create-grid-mode';
import { SceneStep } from '../create-grid-scene-step';

/** The step where investment is entered for a given mode — also the Swap-detour return target. */
export function investmentStepForMode(mode: CreateGridMode | undefined): SceneStep {
    if (mode === CreateGridMode.Quick) return SceneStep.Quick;
    if (mode === CreateGridMode.Ai) return SceneStep.Ai;
    return SceneStep.Investment;
}
