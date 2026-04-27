import axios, { AxiosInstance } from 'axios';

/**
 * Lightweight HTTP client for Hyperliquid /info and /exchange endpoints.
 */
export class HyperliquidHttpClient {
    private readonly http: AxiosInstance;

    constructor(baseUrl: string) {
        this.http = axios.create({
            baseURL: baseUrl,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    async postInfo<T>(body: Record<string, unknown>): Promise<T> {
        const res = await this.http.post<T>('/info', body);
        return res.data;
    }

    async postExchange<T>(body: Record<string, unknown>): Promise<T> {
        const res = await this.http.post<T>('/exchange', body);
        return res.data;
    }
}
