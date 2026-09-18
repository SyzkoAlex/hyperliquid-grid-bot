import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { PredictionApiAdapter } from './prediction-api.adapter';
import { BestGridClientPort } from '../core/application/ports/best-grid-client.port';
import { BestGridDto } from './dto/best-grid.dto';

function makeConfigService(baseUrl: string | undefined): ConfigService<Config, true> {
    return {
        get: vi.fn().mockReturnValue({ baseUrl, requestTimeout: 60000 }),
    } as unknown as ConfigService<Config, true>;
}

describe('PredictionApiAdapter', () => {
    let mockClient: { fetchBestGrid: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockClient = { fetchBestGrid: vi.fn() };
    });

    function makeSut(baseUrl: string | undefined): PredictionApiAdapter {
        return new PredictionApiAdapter(
            mockClient as unknown as BestGridClientPort,
            makeConfigService(baseUrl),
        );
    }

    describe('isAvailable', () => {
        it('returns true when baseUrl is configured', () => {
            expect(makeSut('http://prediction:8080').isAvailable()).toBe(true);
        });

        it('returns false when baseUrl is an empty string', () => {
            expect(makeSut('').isAvailable()).toBe(false);
        });

        it('returns false when baseUrl is undefined', () => {
            expect(makeSut(undefined).isAvailable()).toBe(false);
        });
    });

    describe('getBestGrid', () => {
        it('delegates to the best-grid client port', async () => {
            const dto: BestGridDto = {
                pair: 'HYPE/USDC',
                baseAsset: 'HYPE',
                conservativePnlUsdc: 10,
                recommendedConfig: { lower: 40, upper: 55, nLevels: 10 },
                warnings: [],
                periodDays: 7,
            };
            mockClient.fetchBestGrid.mockResolvedValue(dto);

            const result = await makeSut('http://prediction:8080').getBestGrid('HYPE');

            expect(mockClient.fetchBestGrid).toHaveBeenCalledWith('HYPE');
            expect(result).toBe(dto);
        });
    });
});
