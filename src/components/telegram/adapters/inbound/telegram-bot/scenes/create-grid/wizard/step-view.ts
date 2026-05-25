import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { SummaryRow } from './summary-row';

export interface StepView {
    readonly summaryRows?: SummaryRow[];
    readonly body: string;
    readonly keyboard: InlineButton[][];
}
