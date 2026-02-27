import { GridId } from './grid-id';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { Timestamp } from '@domain/models/primitives/timestamp';

export interface GridCreateParams {
    id?: GridId;
    symbol: TradingSymbol;
    mode: GridMode;
    status?: GridStatus;
    lowerPrice: Price;
    upperPrice: Price;
    levels: number;
    investmentUSDC: Decimal; // USD/USDC for buy orders
    investmentBase: Decimal; // Base asset (BTC/ETH) for sell orders
    trailingEnabled?: boolean;
    trailingTriggerPercent?: number;
    trailingStepPercent?: number;
    trailingPartialClosePercent?: number;
    trailingCount?: number;
    createdAt?: Timestamp;
    startedAt?: Timestamp;
    stoppedAt?: Timestamp;
    lastTrailingAt?: Timestamp;
}
