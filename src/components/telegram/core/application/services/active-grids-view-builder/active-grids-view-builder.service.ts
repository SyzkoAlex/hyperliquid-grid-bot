import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { GetGridsWithPnlUseCase } from '../../use-cases/get-grids-with-pnl/get-grids-with-pnl.use-case';
import { GridFilter } from '../../use-cases/get-grids-with-pnl/grid-filter';
import { ActiveGridsHeaderMessage } from '@components/telegram/core/domain/models/messages/grids/grids-list.messages';
import { GridListMessage } from '@components/telegram/core/domain/models/messages/grids/grid-list.message';
import { GridsListKeyboard } from '@components/telegram/core/domain/models/messages/grids/grids-list.keyboard';
import { GridsAction } from '@components/telegram/core/domain/models/grids-action';
import { ActiveGreetingMessage } from '@components/telegram/core/domain/models/messages/active-greeting-message';
import { ActiveGridsView } from './types/active-grids-view';

@Injectable()
export class ActiveGridsViewBuilder {
    private readonly pageSize: number;

    constructor(
        private readonly getGridsWithPnlUseCase: GetGridsWithPnlUseCase,
        configService: ConfigService<Config, true>,
    ) {
        this.pageSize = configService.get('telegram', { infer: true }).pagination.activePageSize;
    }

    async build(page: number): Promise<ActiveGridsView> {
        const { items, totalCount, currentPage } = await this.getGridsWithPnlUseCase.execute(
            GridFilter.Running,
            page,
            this.pageSize,
        );
        const totalPages = Math.max(1, Math.ceil(totalCount / this.pageSize));
        const startIndex = (currentPage - 1) * this.pageSize;
        const header = ActiveGridsHeaderMessage.create(totalCount, currentPage, totalPages).text;
        const text = GridListMessage.create(header, items, startIndex).text;
        const keyboard = GridsListKeyboard.create(
            items,
            startIndex,
            GridsAction.activePage,
            currentPage,
            totalPages,
        );
        return { text, keyboard, totalCount };
    }

    async buildWithGreeting(page: number, username?: string): Promise<ActiveGridsView> {
        const view = await this.build(page);
        const greeting = ActiveGreetingMessage.create({ username }).text;
        return { ...view, text: `${greeting}\n\n${view.text}` };
    }
}
