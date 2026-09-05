import { Module } from '@nestjs/common';
import { PREDICTION_API_PORT } from './api/prediction-api.port';
import { PredictionApiAdapter } from './api/prediction-api.adapter';
import { BEST_GRID_CLIENT_PORT } from './core/application/ports/best-grid-client.port';
import { HttpBestGridClientAdapter } from './adapters/outbound/http/http-best-grid-client.adapter';

@Module({
    providers: [
        { provide: PREDICTION_API_PORT, useClass: PredictionApiAdapter },
        { provide: BEST_GRID_CLIENT_PORT, useClass: HttpBestGridClientAdapter },
    ],
    exports: [PREDICTION_API_PORT],
})
export class PredictionModule {}
