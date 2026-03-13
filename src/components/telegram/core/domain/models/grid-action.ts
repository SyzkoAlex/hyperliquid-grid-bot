export const GridAction = {
    view: (id: string, page: number) => `view:grid:${id}:p:${page}`,
    ordersTab: (id: string, page: number) => `view:grid:${id}:p:${page}:orders`,
    historyTab: (id: string, page: number) => `view:grid:${id}:p:${page}:history`,
    stop: (id: string) => `stop:grid:${id}`,
    confirmStop: (id: string) => `confirm:stop:${id}`,
    cancelStop: (id: string) => `cancel:stop:${id}`,
    VIEW_PATTERN: /^view:grid:([^:]+):p:(\d+)$/,
    VIEW_ORDERS_PATTERN: /^view:grid:([^:]+):p:(\d+):orders$/,
    VIEW_HISTORY_PATTERN: /^view:grid:([^:]+):p:(\d+):history$/,
    STOP_PATTERN: /^stop:grid:([^:]+)$/,
    CONFIRM_STOP_PATTERN: /^confirm:stop:([^:]+)$/,
    CANCEL_STOP_PATTERN: /^cancel:stop:([^:]+)$/,
} as const;
