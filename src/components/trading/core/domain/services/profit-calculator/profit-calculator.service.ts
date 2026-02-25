import { Injectable } from '@nestjs/common';
import { OrderDto } from '@/components/grids/api/dto/order.dto';
import { GridDto } from '@/components/grids/api/dto/grid.dto';
import { Decimal } from '@domain/models/primitives/decimal';
import { OrderSide } from '@domain/models/order/order-side';

@Injectable()
export class ProfitCalculatorService {
    calculate(filledOrder: OrderDto, grid: GridDto): Decimal | null {
        if (filledOrder.side !== OrderSide.Sell) {
            return null;
        }

        const spacing = (grid.upperPrice - grid.lowerPrice) / (grid.levels - 1);
        return Decimal.from(spacing).mul(Decimal.from(filledOrder.amount));
    }
}
