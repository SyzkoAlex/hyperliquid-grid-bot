import { Grid } from '@domain/grid/grid';
import { Decimal } from '../../../../../domain/primitives/decimal';

export class CreateAndStartGridResult {
    constructor(
        readonly grid: Grid,
        readonly investmentUSDC: Decimal,
        readonly investmentBase: Decimal,
    ) {}
}
