import { Injectable } from '@nestjs/common';
import { Order } from '../../domain/order/order';
import { OrderSide } from '../../domain/order/order-side';
import { Grid } from '../../domain/grid/grid';
import { Decimal } from '../../../../../domain/primitives/decimal';

@Injectable()
export class ProfitCalculatorService {
    calculate(filledOrder: Order, grid: Grid): Decimal | null {
        if (filledOrder.side !== OrderSide.Sell) {
            return null;
        }

        const spacing = grid.getGridSpacing();
        return Decimal.from(spacing.toNumber()).mul(filledOrder.amount);
    }
}
