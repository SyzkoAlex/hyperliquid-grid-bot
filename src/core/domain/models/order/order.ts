import { OrderId } from './order-id';
import { OrderSide } from './order-side';
import { OrderType } from './order-type';
import { OrderStatus } from './order-status';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { Timestamp } from '@domain/models/primitives/timestamp';
import { ExchangeCloid } from '@domain/models/exchange-order/exchange-cloid';
import { GridId } from '../grid/grid-id';

export interface OrderParams {
    id?: OrderId;
    exchangeOrderId?: string;
    cloid?: ExchangeCloid;
    symbol: TradingSymbol;
    type: OrderType;
    side: OrderSide;
    price?: Price;
    amount: Decimal;
    status: OrderStatus;

    // Grid fields (required - only grid orders are stored)
    gridId: GridId;
    levelIndex: number;

    placedAt?: Timestamp;
    filledAt?: Timestamp;
    cancelledAt?: Timestamp;
}

/**
 * Order Entity
 * Represents a trading order
 */
export class Order {
    private readonly _id: OrderId;
    private readonly _exchangeOrderId: string | null;
    private readonly _cloid: ExchangeCloid | null;
    private readonly _symbol: TradingSymbol;
    private readonly _type: OrderType;
    private readonly _side: OrderSide;
    private readonly _price: Price | null;
    private readonly _amount: Decimal;
    private _status: OrderStatus;

    // Grid fields (required)
    private readonly _gridId: GridId;
    private readonly _levelIndex: number;

    private _placedAt: Timestamp | null;
    private _filledAt: Timestamp | null;
    private _cancelledAt: Timestamp | null;

    private constructor(params: OrderParams) {
        this._id = params.id ?? OrderId.create();
        this._exchangeOrderId = params.exchangeOrderId ?? null;
        this._cloid = params.cloid ?? null;
        this._symbol = params.symbol;
        this._type = params.type;
        this._side = params.side;
        this._price = params.price ?? null;
        this._amount = params.amount;
        this._status = params.status;
        this._gridId = params.gridId;
        this._levelIndex = params.levelIndex;
        this._placedAt = params.placedAt ?? null;
        this._filledAt = params.filledAt ?? null;
        this._cancelledAt = params.cancelledAt ?? null;
    }

    static create(params: OrderParams): Order {
        return new Order(params);
    }

    updateStatus(status: OrderStatus) {
        this._status = status;

        if (status === OrderStatus.Placed && !this._placedAt) {
            this._placedAt = Timestamp.now();
        }

        if (status === OrderStatus.Filled && !this._filledAt) {
            this._filledAt = Timestamp.now();
        }

        if (status === OrderStatus.Cancelled && !this._cancelledAt) {
            this._cancelledAt = Timestamp.now();
        }
    }

    isFilled(): boolean {
        return this._status === OrderStatus.Filled;
    }

    isCancelled(): boolean {
        return this._status === OrderStatus.Cancelled;
    }

    isActive(): boolean {
        return this._status === OrderStatus.Pending || this._status === OrderStatus.Placed;
    }

    get exchangeOrderId(): string | null {
        return this._exchangeOrderId;
    }

    get cloid(): ExchangeCloid | null {
        // Calculate cloid on-the-fly from order ID for pending orders
        if (this._status === OrderStatus.Pending && !this._exchangeOrderId) {
            return ExchangeCloid.create(this._id);
        }
        return this._cloid;
    }

    get symbol(): TradingSymbol {
        return this._symbol;
    }

    get type(): OrderType {
        return this._type;
    }

    get side(): OrderSide {
        return this._side;
    }

    get price(): Price | null {
        return this._price;
    }

    get amount(): Decimal {
        return this._amount;
    }

    get status(): OrderStatus {
        return this._status;
    }

    get placedAt(): Timestamp | null {
        return this._placedAt;
    }

    get filledAt(): Timestamp | null {
        return this._filledAt;
    }

    get cancelledAt(): Timestamp | null {
        return this._cancelledAt;
    }

    get id(): OrderId {
        return this._id;
    }

    get gridId(): GridId {
        return this._gridId;
    }

    get levelIndex(): number {
        return this._levelIndex;
    }
}
