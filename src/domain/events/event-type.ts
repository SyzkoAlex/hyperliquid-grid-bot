/**
 * Event types used across the application for pub/sub communication.
 */
export enum EventType {
    // Grid lifecycle events
    CreateGridCommand = 'CreateGridCommandEvent',
    GridCreatedSuccess = 'GridCreatedSuccessEvent',
    GridCreatedError = 'GridCreatedErrorEvent',
    GridStarted = 'GridStartedEvent',
    GridStopped = 'GridStoppedEvent',

    // Trading events
    TradeExecuted = 'TradeExecutedEvent',
}
