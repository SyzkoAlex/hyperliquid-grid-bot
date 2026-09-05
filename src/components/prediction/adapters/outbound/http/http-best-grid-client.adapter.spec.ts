import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { HttpService } from '@/infra/http/http.service';
import { HttpBestGridClientAdapter } from './http-best-grid-client.adapter';
import { BestGridResponseItem } from './best-grid-response-item';
import { PredictionWarning } from '../../../api/dto/prediction-warning';

const BASE_URL = 'http://prediction:8080';
const REQUEST_TIMEOUT = 60000;

function makeConfigService(baseUrl: string | undefined): ConfigService<Config, true> {
    return {
        get: vi.fn().mockReturnValue({ baseUrl, requestTimeout: REQUEST_TIMEOUT }),
    } as unknown as ConfigService<Config, true>;
}

function makeResponseItem(overrides: Partial<BestGridResponseItem> = {}): BestGridResponseItem {
    return {
        pair: 'HYPE/USDC',
        base_asset: 'HYPE',
        conservative_pnl_usdc: '12.50',
        summary: 'Some plain-English paragraph.',
        recommended_config: {
            lower: '40.5',
            upper: '55.25',
            n_levels: 15,
            initial_capital: '1000',
        },
        details: {
            warnings: ['low_liquidity', 'trending_regime'],
            period_days: 7,
        },
        ...overrides,
    };
}

describe('HttpBestGridClientAdapter', () => {
    let sut: HttpBestGridClientAdapter;
    let mockHttp: { get: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockHttp = { get: vi.fn() };
        sut = new HttpBestGridClientAdapter(
            mockHttp as unknown as HttpService,
            makeConfigService(BASE_URL),
        );
    });

    describe('fetchBestGrid', () => {
        it('maps a full response item to the DTO', async () => {
            mockHttp.get.mockResolvedValue({ data: [makeResponseItem()] });

            const result = await sut.fetchBestGrid('HYPE');

            expect(result).toEqual({
                pair: 'HYPE/USDC',
                baseAsset: 'HYPE',
                conservativePnlUsdc: 12.5,
                recommendedConfig: { lower: 40.5, upper: 55.25, nLevels: 15 },
                warnings: [PredictionWarning.LowLiquidity, PredictionWarning.TrendingRegime],
                periodDays: 7,
            });
        });

        it('passes ticker param and per-request timeout to http.get', async () => {
            mockHttp.get.mockResolvedValue({ data: [makeResponseItem()] });

            await sut.fetchBestGrid('HYPE');

            expect(mockHttp.get).toHaveBeenCalledWith(`${BASE_URL}/best-grid`, {
                params: { ticker: 'HYPE' },
                timeout: REQUEST_TIMEOUT,
            });
        });

        it('maps null conservative_pnl_usdc to null', async () => {
            mockHttp.get.mockResolvedValue({
                data: [makeResponseItem({ conservative_pnl_usdc: null })],
            });

            const result = await sut.fetchBestGrid('HYPE');

            expect(result?.conservativePnlUsdc).toBeNull();
        });

        it('maps non-numeric conservative_pnl_usdc to null', async () => {
            mockHttp.get.mockResolvedValue({
                data: [makeResponseItem({ conservative_pnl_usdc: 'not-a-number' })],
            });

            const result = await sut.fetchBestGrid('HYPE');

            expect(result?.conservativePnlUsdc).toBeNull();
        });

        it('maps recommended_config null to null', async () => {
            mockHttp.get.mockResolvedValue({
                data: [makeResponseItem({ recommended_config: null })],
            });

            const result = await sut.fetchBestGrid('HYPE');

            expect(result?.recommendedConfig).toBeNull();
        });

        it('returns null recommendedConfig when lower is not a number', async () => {
            mockHttp.get.mockResolvedValue({
                data: [
                    makeResponseItem({
                        recommended_config: {
                            lower: 'oops',
                            upper: '55',
                            n_levels: 10,
                            initial_capital: '1000',
                        },
                    }),
                ],
            });

            const result = await sut.fetchBestGrid('HYPE');

            expect(result?.recommendedConfig).toBeNull();
        });

        it('returns null recommendedConfig when upper <= lower', async () => {
            mockHttp.get.mockResolvedValue({
                data: [
                    makeResponseItem({
                        recommended_config: {
                            lower: '55',
                            upper: '55',
                            n_levels: 10,
                            initial_capital: '1000',
                        },
                    }),
                ],
            });

            const result = await sut.fetchBestGrid('HYPE');

            expect(result?.recommendedConfig).toBeNull();
        });

        it('returns null recommendedConfig when lower <= 0', async () => {
            mockHttp.get.mockResolvedValue({
                data: [
                    makeResponseItem({
                        recommended_config: {
                            lower: '0',
                            upper: '55',
                            n_levels: 10,
                            initial_capital: '1000',
                        },
                    }),
                ],
            });

            const result = await sut.fetchBestGrid('HYPE');

            expect(result?.recommendedConfig).toBeNull();
        });

        it('drops unknown warning strings and keeps known ones', async () => {
            mockHttp.get.mockResolvedValue({
                data: [
                    makeResponseItem({
                        details: {
                            warnings: ['unstable_fit', 'brand_new_warning'],
                            period_days: 14,
                        },
                    }),
                ],
            });

            const result = await sut.fetchBestGrid('HYPE');

            expect(result?.warnings).toEqual([PredictionWarning.UnstableFit]);
            expect(result?.periodDays).toBe(14);
        });

        it('returns null on an empty array response', async () => {
            mockHttp.get.mockResolvedValue({ data: [] });

            const result = await sut.fetchBestGrid('HYPE');

            expect(result).toBeNull();
        });

        it('returns null on a 404 axios error (unknown ticker)', async () => {
            mockHttp.get.mockRejectedValue({
                isAxiosError: true,
                response: { status: 404 },
            });

            const result = await sut.fetchBestGrid('XYZ');

            expect(result).toBeNull();
        });

        it('rethrows a 500 axios error', async () => {
            const error = { isAxiosError: true, response: { status: 500 } };
            mockHttp.get.mockRejectedValue(error);

            await expect(sut.fetchBestGrid('HYPE')).rejects.toEqual(error);
        });

        it('rethrows a network error without a response', async () => {
            const error = new Error('ECONNREFUSED');
            mockHttp.get.mockRejectedValue(error);

            await expect(sut.fetchBestGrid('HYPE')).rejects.toThrow('ECONNREFUSED');
        });

        it('throws when baseUrl is not configured', async () => {
            const unconfigured = new HttpBestGridClientAdapter(
                mockHttp as unknown as HttpService,
                makeConfigService(''),
            );

            await expect(unconfigured.fetchBestGrid('HYPE')).rejects.toThrow(
                'Prediction service is not configured',
            );
            expect(mockHttp.get).not.toHaveBeenCalled();
        });
    });
});
