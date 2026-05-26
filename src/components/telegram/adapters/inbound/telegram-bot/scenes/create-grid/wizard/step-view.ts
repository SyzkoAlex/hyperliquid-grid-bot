import { InlineButton } from '@components/telegram/core/domain/models/inline-button';

export interface StepView {
    readonly body: string;
    readonly keyboard: InlineButton[][];
}
