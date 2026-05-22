export class AgentNotApprovedError extends Error {
    constructor(
        public readonly accountAddress: string,
        rawError: string,
    ) {
        super(`Agent not approved for ${accountAddress}: ${rawError}`);
        this.name = 'AgentNotApprovedError';
    }
}
