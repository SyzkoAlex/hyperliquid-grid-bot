/**
 * Hyperliquid spot symbol helper.
 *
 * Hyperliquid's /info response uses "{SYMBOL}-SPOT" for spot markets
 * (e.g. "HYPE-SPOT") while the rest of the codebase uses the bare symbol
 * ("HYPE"). This value object encapsulates the suffix convention.
 */
export class HyperliquidSymbol {
    private static readonly SPOT_SUFFIX = '-SPOT';

    static toSpotFormat(symbol: string): string {
        return `${symbol}${HyperliquidSymbol.SPOT_SUFFIX}`;
    }

    static stripSpotSuffix(hyperliquidSymbol: string): string {
        return hyperliquidSymbol.replace(HyperliquidSymbol.SPOT_SUFFIX, '');
    }

    static hasSpotSuffix(hyperliquidSymbol: string): boolean {
        return hyperliquidSymbol.endsWith(HyperliquidSymbol.SPOT_SUFFIX);
    }
}
