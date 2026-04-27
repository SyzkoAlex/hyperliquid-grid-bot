import { ConnectAccountSceneStep } from './connect-account-scene-step';

export interface ConnectAccountWizardState {
    accountAddress?: string;
    userId?: string;
    agentAddress?: string;
    currentStep?: ConnectAccountSceneStep;
}
