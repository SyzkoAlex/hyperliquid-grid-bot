export function extractErrorDetails(error: unknown): {
    errorMessage?: string;
    errorResponse?: unknown;
    errorStack?: string;
} {
    if (!error) {
        return {};
    }

    const errorObj = error as {
        message?: string;
        stack?: string;
        response?: unknown;
    };

    let errorResponse = errorObj.response;
    if (errorResponse && typeof errorResponse === 'object' && 'data' in errorResponse) {
        errorResponse = (errorResponse as { data: unknown }).data;
    }

    return {
        errorMessage: errorObj.message,
        errorResponse,
        errorStack: errorObj.stack,
    };
}
