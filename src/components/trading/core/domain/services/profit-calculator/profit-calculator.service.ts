import { Injectable } from '@nestjs/common';
import { Decimal } from '@domain/models/primitives/decimal';

@Injectable()
export class ProfitCalculatorService {
    calculate(
        orderAmount: number,
        gridUpperPrice: number,
        gridLowerPrice: number,
        orderCount: number,
    ): Decimal {
        const spacing = (gridUpperPrice - gridLowerPrice) / (orderCount - 1);
        return Decimal.from(spacing).mul(Decimal.from(orderAmount));
    }
}
