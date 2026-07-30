import { WIZARD_CONFIG } from '../../constants/wizard-config';

export class AdvancedOrdersTexts {
    static readonly PROMPT = `How many grid orders?\n\nSelect preset or enter custom value (${WIZARD_CONFIG.MIN_ORDERS}-${WIZARD_CONFIG.MAX_ORDERS}):`;
}
