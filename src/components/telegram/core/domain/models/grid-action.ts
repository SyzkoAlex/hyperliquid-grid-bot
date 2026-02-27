export const GridAction = {
    view: (id: string) => `view:grid:${id}`,
    ordersTab: (id: string) => `view:grid:${id}:orders`,
    historyTab: (id: string) => `view:grid:${id}:history`,
    stop: (id: string) => `stop:grid:${id}`,
    confirmStop: (id: string) => `confirm:stop:${id}`,
    cancelStop: (id: string) => `cancel:stop:${id}`,
    VIEW_PATTERN: /^view:grid:([^:]+)$/,
    VIEW_ORDERS_PATTERN: /^view:grid:([^:]+):orders$/,
    VIEW_HISTORY_PATTERN: /^view:grid:([^:]+):history$/,
    STOP_PATTERN: /^stop:grid:([^:]+)$/,
    CONFIRM_STOP_PATTERN: /^confirm:stop:([^:]+)$/,
    CANCEL_STOP_PATTERN: /^cancel:stop:([^:]+)$/,
} as const;
