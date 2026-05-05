export function floatToWire(x: number): string {
    const rounded = x.toFixed(8);
    if (Math.abs(parseFloat(rounded) - x) >= 1e-12) {
        throw new Error(`floatToWire causes rounding: ${x}`);
    }
    const normalized = rounded.replace(/\.?0+$/, '');
    return normalized === '-0' ? '0' : normalized;
}
