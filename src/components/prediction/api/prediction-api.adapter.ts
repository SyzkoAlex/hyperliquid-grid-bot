import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { PredictionApiPort } from './prediction-api.port';
import { BestGridDto } from './dto/best-grid.dto';
import {
    BEST_GRID_CLIENT_PORT,
    BestGridClientPort,
} from '../core/application/ports/best-grid-client.port';

@Injectable()
export class PredictionApiAdapter implements PredictionApiPort {
    private readonly baseUrl: string;

    constructor(
        @Inject(BEST_GRID_CLIENT_PORT) private readonly bestGridClient: BestGridClientPort,
        configService: ConfigService<Config, true>,
    ) {
        this.baseUrl = configService.get('prediction', { infer: true }).baseUrl ?? '';
    }

    isAvailable(): boolean {
        return this.baseUrl !== '';
    }

    getBestGrid(ticker: string): Promise<BestGridDto | null> {
        return this.bestGridClient.fetchBestGrid(ticker);
    }
}
