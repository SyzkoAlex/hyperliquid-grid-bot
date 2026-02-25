/**
 * Hyperliquid Symbol Formatter
 *
 * Handles conversion between string symbols and Hyperliquid-specific symbol formats.
 * Single source of truth for Hyperliquid symbol formatting.
 */
export class HyperliquidSymbol {
    /**
     * Convert symbol to Hyperliquid SPOT format
     * @param symbol - Symbol string (e.g., 'ETH')
     * @returns Hyperliquid SPOT symbol (e.g., 'ETH-SPOT')
     *
     * @example
     * HyperliquidSymbol.toSpotFormat('ETH') // => 'ETH-SPOT'
     */
    static toSpotFormat(symbol: string): string {
        return `${symbol}-SPOT`;
    }

    /**
     * Remove -SPOT suffix from Hyperliquid symbol
     * @param hyperliquidSymbol - Symbol with -SPOT suffix
     * @returns Symbol without -SPOT suffix
     *
     * @example
     * HyperliquidSymbol.stripSpotSuffix('ETH-SPOT') // => 'ETH'
     */
    static stripSpotSuffix(hyperliquidSymbol: string): string {
        return hyperliquidSymbol.replace('-SPOT', '');
    }

    /**
     * Check if a symbol has the -SPOT suffix
     * @param hyperliquidSymbol - Symbol to check
     * @returns true if symbol ends with -SPOT
     */
    static hasSpotSuffix(hyperliquidSymbol: string): boolean {
        return hyperliquidSymbol.endsWith('-SPOT');
    }
}
