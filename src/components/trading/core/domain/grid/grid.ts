import { GridId } from './grid-id';
import { GridStatus } from './grid-status';
import { GridMode } from './grid-mode';
import { GridCreateParams } from './grid-create-params';
import { Symbol } from '../common/symbol';
import { Price } from '../common/price';
import { Decimal } from '../../../../../domain/primitives/decimal';
import { Timestamp } from '../../../../../domain/primitives/timestamp';

/**
 * Grid Entity for SPOT Trading
 *
 * SPOT Grid Trading:
 * - Physical tokens (no leverage, no liquidation risk)
 * - Buy low, sell high strategy
 * - Neutral or Long mode (Short not available on spot)
 * - Trailing-Up support for bull markets
 *
 * Capital Distribution:
 * - investmentUSDC: USD for buy orders below current price
 * - investmentBase: Base tokens for sell orders above current price
 */
export class Grid {
    private readonly _id: GridId;
    private readonly _symbol: Symbol;
    private readonly _mode: GridMode;
    private _status: GridStatus;
    private _lowerPrice: Price;
    private _upperPrice: Price;
    private readonly _levels: number;
    private readonly _investmentUSDC: Decimal;
    private readonly _investmentBase: Decimal;
    private readonly _trailingEnabled: boolean;
    private readonly _trailingTriggerPercent: number;
    private readonly _trailingStepPercent: number;
    private readonly _trailingPartialClosePercent: number;
    private _startedAt: Timestamp | null;
    private _stoppedAt: Timestamp | null;
    private _lastTrailingAt: Timestamp | null;
    private _trailingCount: number;

    private constructor(params: GridCreateParams) {
        this._id = params.id ?? GridId.create();
        this._symbol = params.symbol;
        this._mode = params.mode;
        this._status = params.status ?? GridStatus.Idle;
        this._lowerPrice = params.lowerPrice;
        this._upperPrice = params.upperPrice;
        this._levels = params.levels;
        this._investmentUSDC = params.investmentUSDC;
        this._investmentBase = params.investmentBase;
        this._trailingEnabled = params.trailingEnabled ?? false;
        this._trailingTriggerPercent = params.trailingTriggerPercent ?? 5;
        this._trailingStepPercent = params.trailingStepPercent ?? 10;
        this._trailingPartialClosePercent = params.trailingPartialClosePercent ?? 50;
        this._startedAt = params.startedAt ?? null;
        this._stoppedAt = params.stoppedAt ?? null;
        this._lastTrailingAt = params.lastTrailingAt ?? null;
        this._trailingCount = params.trailingCount ?? 0;
    }

    static create(params: GridCreateParams): Grid {
        const grid = new Grid(params);
        grid.validate();
        return grid;
    }

    private validate() {
        if (this._lowerPrice.gte(this._upperPrice)) {
            throw new Error('Lower price must be less than upper price');
        }
        if (this._levels < 5 || this._levels > 100) {
            throw new Error('Levels must be between 5 and 100');
        }
        if (this._investmentUSDC.lte(Decimal.zero())) {
            throw new Error('Investment USDC must be positive');
        }
        if (this._investmentBase.lt(Decimal.zero())) {
            throw new Error('Investment base cannot be negative');
        }
        // Neutral mode requires both quote and base
        if (this._mode === GridMode.Neutral && this._investmentBase.isZero()) {
            throw new Error('Neutral mode requires both quote and base investment');
        }
        // Validate trailing percentages
        if (this._trailingTriggerPercent < 0 || this._trailingTriggerPercent > 50) {
            throw new Error('Trailing trigger must be between 0 and 50%');
        }
        if (this._trailingStepPercent < 1 || this._trailingStepPercent > 50) {
            throw new Error('Trailing step must be between 1 and 50%');
        }
        if (this._trailingPartialClosePercent < 0 || this._trailingPartialClosePercent > 100) {
            throw new Error('Trailing partial close must be between 0 and 100%');
        }
    }

    start() {
        if (this._status !== GridStatus.Idle && this._status !== GridStatus.Stopped) {
            throw new Error('Grid can only be started from idle or stopped state');
        }
        this._status = GridStatus.Running;
        this._startedAt = Timestamp.now();
    }

    stop() {
        if (this._status !== GridStatus.Running && this._status !== GridStatus.Paused) {
            throw new Error('Grid must be running or paused to stop');
        }
        this._status = GridStatus.Stopped;
        this._stoppedAt = Timestamp.now();
    }

    pause() {
        if (this._status !== GridStatus.Running) {
            throw new Error('Grid must be running to pause');
        }
        this._status = GridStatus.Paused;
    }

    resume() {
        if (this._status !== GridStatus.Paused) {
            throw new Error('Grid must be paused to resume');
        }
        this._status = GridStatus.Running;
    }

    /**
     * Calculate grid spacing (price difference between levels)
     */
    getGridSpacing(): Price {
        const range = this._upperPrice.sub(this._lowerPrice);
        return range.div(this._levels - 1);
    }

    /**
     * Calculate price for a specific level (0-indexed)
     */
    getLevelPrice(levelIndex: number): Price {
        if (levelIndex < 0 || levelIndex >= this._levels) {
            throw new Error(`Invalid level index: ${levelIndex}`);
        }
        const spacing = this.getGridSpacing();
        return this._lowerPrice.add(spacing.mul(levelIndex));
    }

    /**
     * Check if trailing should be activated
     */
    shouldActivateTrailing(currentPrice: Price): boolean {
        if (!this._trailingEnabled) return false;
        if (this._status !== GridStatus.Running) return false;

        const triggerPrice = this._upperPrice.mul(1 + this._trailingTriggerPercent / 100);
        return currentPrice.gt(triggerPrice);
    }

    /**
     * Execute trailing-up (shift grid higher)
     */
    executeTrailing() {
        if (!this._trailingEnabled) {
            throw new Error('Trailing is not enabled');
        }

        const multiplier = 1 + this._trailingStepPercent / 100;
        this._lowerPrice = this._lowerPrice.mul(multiplier);
        this._upperPrice = this._upperPrice.mul(multiplier);
        this._lastTrailingAt = Timestamp.now();
        this._trailingCount++;
    }

    /**
     * Check if enough time passed since last trailing (cooldown)
     */
    canTrailNow(cooldownMinutes: number): boolean {
        if (!this._lastTrailingAt) return true;

        const now = Timestamp.now();
        const minutesSinceLastTrailing = now.differenceInMinutes(this._lastTrailingAt);

        return minutesSinceLastTrailing >= cooldownMinutes;
    }

    get symbol(): Symbol {
        return this._symbol;
    }

    get mode(): GridMode {
        return this._mode;
    }

    get status(): GridStatus {
        return this._status;
    }

    get lowerPrice(): Price {
        return this._lowerPrice;
    }

    get upperPrice(): Price {
        return this._upperPrice;
    }

    get levels(): number {
        return this._levels;
    }

    get investmentUSDC(): Decimal {
        return this._investmentUSDC;
    }

    get investmentBase(): Decimal {
        return this._investmentBase;
    }

    get trailingEnabled(): boolean {
        return this._trailingEnabled;
    }

    get trailingTriggerPercent(): number {
        return this._trailingTriggerPercent;
    }

    get trailingStepPercent(): number {
        return this._trailingStepPercent;
    }

    get trailingPartialClosePercent(): number {
        return this._trailingPartialClosePercent;
    }

    get startedAt(): Timestamp | null {
        return this._startedAt;
    }

    get stoppedAt(): Timestamp | null {
        return this._stoppedAt;
    }

    get lastTrailingAt(): Timestamp | null {
        return this._lastTrailingAt;
    }

    get trailingCount(): number {
        return this._trailingCount;
    }

    get id(): GridId {
        return this._id;
    }

    equals(other: Grid): boolean {
        return this._id.equals(other._id);
    }
}
