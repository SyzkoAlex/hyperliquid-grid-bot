export function roundToDecimals(value: number, decimals: number): number {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
}

/** Truncate to avoid exceeding available balance when rounding order sizes */
export function floorToDecimals(value: number, decimals: number): number {
    const multiplier = Math.pow(10, decimals);
    return Math.floor(value * multiplier) / multiplier;
}

/** Round up to ensure sell order notional stays at or above exchange minimum after rounding */
export function ceilToDecimals(value: number, decimals: number): number {
    const multiplier = Math.pow(10, decimals);
    return Math.ceil(value * multiplier) / multiplier;
}
