import {
    BadRequestException,
    Controller,
    Get,
    NotFoundException,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { UserDto } from '@components/users/api/dto/user.dto';
import { GetMyGridsUseCase } from '../../../core/application/use-cases/get-my-grids/get-my-grids.use-case';
import { GetMyGridUseCase } from '../../../core/application/use-cases/get-my-grid/get-my-grid.use-case';
import { InternalJwtGuard } from './internal-jwt.guard';
import { CurrentWebUser } from './current-web-user.decorator';
import { WebApiMapper } from './web-api.mapper';
import { gridsQuerySchema } from './grids-query';
import { WebUserDto } from './dto/web-user.dto';
import { WebGridsPageDto } from './dto/web-grids-page.dto';
import { WebGridDetailDto } from './dto/web-grid-detail.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

/** Read-only, user-scoped internal API for the website backend. */
@Controller('internal/web/v1')
@UseGuards(InternalJwtGuard)
export class WebApiAdapter {
    constructor(
        private readonly getMyGrids: GetMyGridsUseCase,
        private readonly getMyGrid: GetMyGridUseCase,
    ) {}

    @Get('me')
    me(@CurrentWebUser() user: UserDto): WebUserDto {
        return WebApiMapper.toWebUser(user);
    }

    @Get('grids')
    async grids(
        @CurrentWebUser() user: UserDto,
        @Query() query: Record<string, unknown>,
    ): Promise<WebGridsPageDto> {
        const parsed = gridsQuerySchema.safeParse(query);
        if (!parsed.success) throw new BadRequestException();
        const { status, page, pageSize } = parsed.data;
        const result = await this.getMyGrids.execute(
            user.id,
            status,
            page ?? DEFAULT_PAGE,
            pageSize ?? DEFAULT_PAGE_SIZE,
        );
        return {
            items: result.items.map((s) => WebApiMapper.toWebGrid(s)),
            totalCount: result.totalCount,
            currentPage: result.currentPage,
        };
    }

    @Get('grids/:id')
    async grid(
        @CurrentWebUser() user: UserDto,
        @Param('id') id: string,
    ): Promise<WebGridDetailDto> {
        if (!z.uuid().safeParse(id).success) throw new NotFoundException();
        const snapshot = await this.getMyGrid.execute(user.id, id);
        if (!snapshot) throw new NotFoundException();
        return WebApiMapper.toWebGridDetail(snapshot);
    }
}
