/** Detects axios errors with a specific HTTP status on the response. */
export function isHttpError(error: unknown, code: number): boolean {
    return (
        error instanceof Error &&
        'response' in error &&
        (error as Error & { response: { status: number } }).response?.status === code
    );
}
