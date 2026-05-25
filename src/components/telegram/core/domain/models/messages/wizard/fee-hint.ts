import { HYPERLIQUID_SPOT_FEE } from '../../constants/hyperliquid-fees';
import { EMOJI } from '../../constants/emoji';

export const FEE_HINT_LINE = `${EMOJI.MONEY_WINGS} Trading fee: ~${(HYPERLIQUID_SPOT_FEE.takerRate * 100).toFixed(2)}% taker / ~${(HYPERLIQUID_SPOT_FEE.makerRate * 100).toFixed(2)}% maker`;
