/**
 * OrderStatus Enum
 * Represents the status of an order
 */
export enum OrderStatus {
    Pending = 'pending',
    Placed = 'placed',
    Filled = 'filled',
    Cancelled = 'cancelled',
    Failed = 'failed',
    Missing = 'missing',
}
