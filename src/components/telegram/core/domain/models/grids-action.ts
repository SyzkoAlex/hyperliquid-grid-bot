export const GridsAction = {
    activePage: (page: number) => `grids:active:${page}`,
    ACTIVE_PAGE_PATTERN: /^grids:active:(\d+)$/,
    stoppedPage: (page: number) => `grids:stopped:${page}`,
    STOPPED_PAGE_PATTERN: /^grids:stopped:(\d+)$/,
} as const;
