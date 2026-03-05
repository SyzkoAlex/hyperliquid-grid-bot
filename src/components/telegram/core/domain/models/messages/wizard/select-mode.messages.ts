import { EMOJI } from '../../constants/emoji';
import { WIZARD_CONFIG } from '../../constants/wizard-config';

export class SelectModeMessages {
    static readonly PROMPT =
        `${EMOJI.LIGHTNING} <b>Quick start</b>: Auto-configuration with ±${WIZARD_CONFIG.PRICE_RANGE_PERCENT}% price range and ${WIZARD_CONFIG.DEFAULT_LEVELS} levels\n` +
        `${EMOJI.SETTINGS} <b>Advanced</b>: Manual configuration of all parameters`;

    static readonly QUICK_MODE_CONFIRMATION = `${EMOJI.SUCCESS} Quick start mode selected`;
    static readonly ADVANCED_MODE_CONFIRMATION = `${EMOJI.SUCCESS} Advanced mode selected`;
}
