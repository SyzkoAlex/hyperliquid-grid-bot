function removeTrailingZeros(value: string): string {
    if (!value.includes('.')) return value;
    const normalized = value.replace(/\.?0+$/, '');
    return normalized === '-0' ? '0' : normalized;
}

/** Normalizes price/size wire fields before msgpack encoding for signing */
export function normalizeTrailingZeros<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return obj as T;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(normalizeTrailingZeros) as T;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if ((key === 'p' || key === 's') && typeof value === 'string') {
            result[key] = removeTrailingZeros(value);
        } else {
            result[key] = normalizeTrailingZeros(value);
        }
    }
    return result as T;
}
