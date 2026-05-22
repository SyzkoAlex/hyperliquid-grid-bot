export const AGENT_EXPIRATION_HANDLER_PORT = Symbol('AGENT_EXPIRATION_HANDLER_PORT');

export interface AgentExpirationHandlerPort {
    handleAgentExpired(accountAddress: string): Promise<void>;
}
