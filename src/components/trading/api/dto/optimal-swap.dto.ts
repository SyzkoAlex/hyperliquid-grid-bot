// SwapSide is a domain enum that is intentionally part of this component's
// public API contract — callers (e.g. Telegram) refer to it via this boundary
// rather than importing directly from the domain layer.
import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';

export { SwapSide };

export interface OptimalSwapDto {
    side: SwapSide;
    amountUsdc: number;
    expectedReceived: number;
}
