import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from './step-result';
import { StepView } from './step-view';

export interface WizardStep {
    readonly id: SceneStep;
    buildView(ctx: BotContext): Promise<StepView>;
    rollbackState(ctx: BotContext): void;
    handleTextInput?(ctx: BotContext, text: string): Promise<StepResult>;
}
