import { WebGridDto } from './web-grid.dto';

export interface WebGridsPageDto {
    items: WebGridDto[];
    totalCount: number;
    currentPage: number;
}
