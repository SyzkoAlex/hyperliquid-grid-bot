import { GridDto } from '@components/grids/api/dto/grid.dto';
import { Decimal } from '@domain/models/primitives/decimal';

export class CreateAndStartGridResult {
    constructor(
        readonly grid: GridDto,
        readonly investmentUSDC: Decimal,
        readonly investmentBase: Decimal,
    ) {}
}
