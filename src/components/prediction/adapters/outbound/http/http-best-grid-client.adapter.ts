import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { Config } from '@/config/config.schema';
import { HttpService } from '@/infra/http/http.service';
import { logger } from '@/infra/logger/logger';
import { BestGridClientPort } from '../../../core/application/ports/best-grid-client.port';
import { BestGridDto } from '../../../api/dto/best-grid.dto';
import { RecommendedGridConfigDto } from '../../../api/dto/recommended-grid-config.dto';
import { PredictionWarning } from '../../../api/dto/prediction-warning';
import { BestGridResponseItem } from './best-grid-response-item';

@Injectable()
export class HttpBestGridClientAdapter implements BestGridClientPort {
    private readonly logger = logger.child({ context: HttpBestGridClientAdapter.name });
    private readonly baseUrl: string;
    private readonly requestTimeout: number;

    constructor(
        private readonly http: HttpService,
        configService: ConfigService<Config, true>,
    ) {
        const { baseUrl, requestTimeout } = configService.get('prediction', { infer: true });
        this.baseUrl = baseUrl ?? '';
        this.requestTimeout = requestTimeout;
    }

    async fetchBestGrid(ticker: string): Promise<BestGridDto | null> {
        if (!this.baseUrl) {
            throw new Error('Prediction service is not configured');
        }
        try {
            const response = await this.http.get<BestGridResponseItem[]>(
                `${this.baseUrl}/suggest`,
                { params: { ticker, strategy: 'simple' }, timeout: this.requestTimeout },
            );
            const item = response.data[0];
            return item ? this.mapToDto(item) : null;
        } catch (error) {
            if (isAxiosError(error) && error.response?.status === 404) {
                this.logger.warn({ ticker }, 'Prediction service does not know this ticker');
                return null;
            }
            throw error;
        }
    }

    private mapToDto(item: BestGridResponseItem): BestGridDto {
        const conservativePnl =
            item.conservative_pnl_usdc === null ? null : Number(item.conservative_pnl_usdc);
        return {
            pair: item.pair,
            baseAsset: item.base_asset,
            conservativePnlUsdc:
                conservativePnl === null || Number.isNaN(conservativePnl) ? null : conservativePnl,
            recommendedConfig: this.mapRecommendedConfig(item.recommended_config),
            warnings: item.details.warnings.filter((warning): warning is PredictionWarning =>
                Object.values(PredictionWarning).includes(warning as PredictionWarning),
            ),
            periodDays: item.details.period_days,
        };
    }

    private mapRecommendedConfig(
        config: BestGridResponseItem['recommended_config'],
    ): RecommendedGridConfigDto | null {
        if (!config) {
            return null;
        }
        const lower = Number(config.lower);
        const upper = Number(config.upper);
        if (Number.isNaN(lower) || Number.isNaN(upper) || lower <= 0 || upper <= lower) {
            this.logger.warn({ config }, 'Discarding malformed recommended grid config');
            return null;
        }
        return { lower, upper, nLevels: config.n_levels };
    }
}
