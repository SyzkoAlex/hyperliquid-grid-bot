import { Scenes } from 'telegraf';
import { CreateGridWizardState } from '../scenes/create-grid/create-grid-wizard-state';

export interface SessionData extends Scenes.SceneSession<Scenes.SceneSessionData> {
    createGrid?: CreateGridWizardState;
}
