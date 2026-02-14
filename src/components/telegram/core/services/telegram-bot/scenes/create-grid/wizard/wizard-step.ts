import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from './step-result';

export interface WizardStep {
    readonly id: SceneStep;
    enter(ctx: BotContext): Promise<void>;
    rollbackState(ctx: BotContext): void;
    handleTextInput?(ctx: BotContext, text: string): Promise<StepResult>;
}
