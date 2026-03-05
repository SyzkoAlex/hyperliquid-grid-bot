import { EMOJI } from '../../constants/emoji';
import { WIZARD_CONFIG } from '../../constants/wizard-config';

export class AdvancedLevelsMessages {
    static readonly PROMPT = `How many grid levels?\n\nSelect preset or enter custom value (${WIZARD_CONFIG.MIN_LEVELS}-${WIZARD_CONFIG.MAX_LEVELS}):`;

    static confirmation(levels: number): string {
        return `${EMOJI.SUCCESS} Grid levels set: ${levels}`;
    }
}
