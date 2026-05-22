export function isAgentNotApprovedError(error: unknown): boolean {
    const msg = String(error).toLowerCase();
    return (
        msg.includes('not approved') ||
        (msg.includes('user or api wallet') && msg.includes('does not exist'))
    );
}
