import { Grid } from '@domain/models/grid/grid';
import { Decimal } from '@domain/models/primitives/decimal';

export class CreateAndStartGridResult {
    constructor(
        readonly grid: Grid,
        readonly investmentUSDC: Decimal,
        readonly investmentBase: Decimal,
    ) {}
}
