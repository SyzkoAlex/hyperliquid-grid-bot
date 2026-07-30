import { EMOJI } from '../../constants/emoji';
import { WIZARD_CONFIG } from '../../constants/wizard-config';

export class SelectModeTexts {
    static readonly PROMPT =
        `${EMOJI.LIGHTNING} <b>Quick start</b>: Auto-configuration with ±${WIZARD_CONFIG.PRICE_RANGE_PERCENT}% price range and ${WIZARD_CONFIG.DEFAULT_ORDERS} orders\n` +
        `${EMOJI.SETTINGS} <b>Advanced</b>: Manual configuration of all parameters`;
}
