import { GridSnapshotDto } from '@components/grids/api/dto/grid-snapshot.dto';

export interface MyGridsPage {
    items: GridSnapshotDto[];
    totalCount: number;
    currentPage: number;
}
