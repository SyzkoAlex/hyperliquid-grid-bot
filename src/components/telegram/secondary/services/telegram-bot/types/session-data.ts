import { Scenes } from 'telegraf';
import { CreateGridWizardState } from '../../../../core/domain/create-grid-wizard-state';

export interface SessionData extends Scenes.SceneSession<Scenes.SceneSessionData> {
    createGrid?: CreateGridWizardState;
}
