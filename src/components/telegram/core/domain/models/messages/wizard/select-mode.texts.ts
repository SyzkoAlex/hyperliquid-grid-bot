import { EMOJI } from '../../constants/emoji';
import { WIZARD_CONFIG } from '../../constants/wizard-config';

export class SelectModeTexts {
    static prompt(isAiAvailable: boolean): string {
        const primaryLine = isAiAvailable
            ? `${EMOJI.ROBOT} <b>AI mode</b>: Range and order count suggested by backtests on recent market data`
            : `${EMOJI.LIGHTNING} <b>Quick start</b>: Auto-configuration with ±${WIZARD_CONFIG.PRICE_RANGE_PERCENT}% price range and ${WIZARD_CONFIG.DEFAULT_ORDERS} orders`;
        return (
            primaryLine +
            `\n${EMOJI.SETTINGS} <b>Advanced</b>: Manual configuration of all parameters`
        );
    }
}
