export enum EventType {
    CreateGridCommand = 'CreateGridCommandEvent',
    StopGridCommand = 'StopGridCommandEvent',
    OrderOpened = 'OrderOpenedEvent',
    OrderClosed = 'OrderClosedEvent',
    GridCreatedSuccess = 'GridCreatedSuccessEvent',
    GridCreatedError = 'GridCreatedErrorEvent',
    GridStopLossTriggered = 'GridStopLossTriggeredEvent',
    AgentApprovalLost = 'AgentApprovalLostEvent',
}
