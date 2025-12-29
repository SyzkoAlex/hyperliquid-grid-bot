import { GridId } from './grid-id';
import { GridMode } from './grid-mode';
import { GridStatus } from './grid-status';
import { Symbol } from '../common/symbol';
import { Price } from '../common/price';
import { Decimal } from '../../../../../domain/primitives/decimal';
import { Timestamp } from '../../../../../domain/primitives/timestamp';

export interface GridCreateParams {
    id?: GridId;
    symbol: Symbol;
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
    startedAt?: Timestamp;
    stoppedAt?: Timestamp;
    lastTrailingAt?: Timestamp;
}
