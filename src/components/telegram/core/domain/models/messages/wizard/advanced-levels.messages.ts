import { EMOJI } from '../../constants/emoji';
import { WIZARD_CONFIG } from '../../constants/wizard-config';

export class AdvancedLevelsTexts {
    static readonly PROMPT = `How many grid levels?\n\nSelect preset or enter custom value (${WIZARD_CONFIG.MIN_LEVELS}-${WIZARD_CONFIG.MAX_LEVELS}):`;
}

export class AdvancedLevelsConfirmationMessage {
    readonly text: string;

    private constructor(levels: number) {
        this.text = `${EMOJI.SUCCESS} Grid levels set: ${levels}`;
    }

    static create(levels: number): AdvancedLevelsConfirmationMessage {
        return new AdvancedLevelsConfirmationMessage(levels);
    }
}
