import { CreateGridWizardState } from './create-grid-wizard-state';
import { InlineButton } from './inline-button';

export interface WizardContext {
    reply(
        message: string,
        keyboard?: InlineButton[][],
        parseMode?: 'HTML' | 'Markdown',
    ): Promise<void>;
    getSession(): WizardSession;
    leaveScene(): Promise<void>;
}

export interface WizardSession {
    createGrid?: CreateGridWizardState;
}
