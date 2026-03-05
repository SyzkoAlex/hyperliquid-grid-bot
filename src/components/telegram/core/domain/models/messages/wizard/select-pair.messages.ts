import { EMOJI } from '../../constants/emoji';

export class SelectPairMessages {
    static readonly PROMPT = 'Select token (all pairs trade against USDC):';
    static readonly OTHER_TOKEN_PROMPT = 'Enter token symbol (e.g., HYPE, BTC, ETH):';

    static confirmation(symbol: string): string {
        return `${EMOJI.SUCCESS} Selected: ${symbol}/USDC`;
    }
}
