import { Order } from '@domain/models/order/order';
import { OrderSide } from '@domain/models/order/order-side';
import { Grid } from '@domain/models/grid/grid';
import { Decimal } from '@domain/models/primitives/decimal';

export class ProfitCalculatorService {
    calculate(filledOrder: Order, grid: Grid): Decimal | null {
        if (filledOrder.side !== OrderSide.Sell) {
            return null;
        }

        const spacing = grid.getGridSpacing();
        return Decimal.from(spacing.toNumber()).mul(filledOrder.amount);
    }
}
