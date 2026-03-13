import { EMOJI } from '../../constants/emoji';

export class SelectPairTexts {
    static readonly PROMPT = 'Select token (all pairs trade against USDC):';
    static readonly OTHER_TOKEN_PROMPT = 'Enter token symbol (e.g., HYPE, BTC, ETH):';
}

export class SelectPairConfirmationMessage {
    readonly text: string;

    private constructor(symbol: string) {
        this.text = `${EMOJI.SUCCESS} Selected: ${symbol}/USDC`;
    }

    static create(symbol: string): SelectPairConfirmationMessage {
        return new SelectPairConfirmationMessage(symbol);
    }
}
