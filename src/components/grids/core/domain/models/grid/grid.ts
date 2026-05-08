import { GridId } from './grid-id';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridCreateParams } from './grid-create-params';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { Timestamp } from '@domain/models/primitives/timestamp';
import { STOP_LOSS_MIN_BUFFER_FROM_LOWER } from '@domain/constants/stop-loss.constants';

export class Grid {
    private readonly _id: GridId;
    private readonly _userId: string;
    private readonly _symbol: TradingSymbol;
    private _status: GridStatus;
    private readonly _lowerPrice: Price;
    private readonly _upperPrice: Price;
    private readonly _levels: number;
    private readonly _investmentUSDC: Decimal;
    private readonly _investmentBase: Decimal;
    private readonly _creationPrice: Price | null;
    private readonly _trailingEnabled: boolean;
    private readonly _trailingTriggerPercent: number;
    private readonly _trailingStepPercent: number;
    private readonly _trailingPartialClosePercent: number;
    private readonly _createdAt: Timestamp;
    private _startedAt: Timestamp | null;
    private _stoppedAt: Timestamp | null;
    private _lastTrailingAt: Timestamp | null;
    private _trailingCount: number;
    private readonly _stopLossEnabled: boolean;
    private readonly _stopLossPrice: Price | null;
    private _stopLossTriggeredAt: Timestamp | null;

    private constructor(params: GridCreateParams) {
        this._id = params.id ?? GridId.create();
        this._userId = params.userId;
        this._symbol = params.symbol;
        this._status = params.status ?? GridStatus.Idle;
        this._lowerPrice = params.lowerPrice;
        this._upperPrice = params.upperPrice;
        this._levels = params.levels;
        this._investmentUSDC = params.investmentUSDC;
        this._investmentBase = params.investmentBase;
        this._creationPrice = params.creationPrice ?? null;
        this._trailingEnabled = params.trailingEnabled ?? false;
        this._trailingTriggerPercent = params.trailingTriggerPercent ?? 5;
        this._trailingStepPercent = params.trailingStepPercent ?? 10;
        this._trailingPartialClosePercent = params.trailingPartialClosePercent ?? 50;
        this._createdAt = params.createdAt ?? Timestamp.now();
        this._startedAt = params.startedAt ?? null;
        this._stoppedAt = params.stoppedAt ?? null;
        this._lastTrailingAt = params.lastTrailingAt ?? null;
        this._trailingCount = params.trailingCount ?? 0;
        this._stopLossEnabled = params.stopLossEnabled ?? false;
        this._stopLossPrice = params.stopLossPrice ?? null;
        this._stopLossTriggeredAt = params.stopLossTriggeredAt ?? null;
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
        if (this._trailingTriggerPercent < 0 || this._trailingTriggerPercent > 50) {
            throw new Error('Trailing trigger must be between 0 and 50%');
        }
        if (this._trailingStepPercent < 1 || this._trailingStepPercent > 50) {
            throw new Error('Trailing step must be between 1 and 50%');
        }
        if (this._trailingPartialClosePercent < 0 || this._trailingPartialClosePercent > 100) {
            throw new Error('Trailing partial close must be between 0 and 100%');
        }
        if (this._stopLossEnabled) {
            if (!this._stopLossPrice) {
                throw new Error('Stop-loss enabled but stopLossPrice missing');
            }
            if (this._stopLossPrice.gte(this._lowerPrice)) {
                throw new Error('Stop-loss price must be strictly below lower price');
            }
            const minBuffer = this._lowerPrice.toNumber() * (1 - STOP_LOSS_MIN_BUFFER_FROM_LOWER);
            if (this._stopLossPrice.toNumber() >= minBuffer) {
                throw new Error('Stop-loss price must be at least 0.5% below lower price');
            }
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

    get symbol(): TradingSymbol {
        return this._symbol;
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

    get creationPrice(): Price | null {
        return this._creationPrice;
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

    get createdAt(): Timestamp {
        return this._createdAt;
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

    get stopLossEnabled(): boolean {
        return this._stopLossEnabled;
    }

    get stopLossPrice(): Price | null {
        return this._stopLossPrice;
    }

    get stopLossTriggeredAt(): Timestamp | null {
        return this._stopLossTriggeredAt;
    }

    get id(): GridId {
        return this._id;
    }

    get userId(): string {
        return this._userId;
    }

    markStopLossTriggered(): void {
        this._stopLossTriggeredAt = Timestamp.now();
    }

    equals(other: Grid): boolean {
        return this._id.equals(other._id);
    }
}
