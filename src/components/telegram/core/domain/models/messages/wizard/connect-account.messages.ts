export const ConnectAccountMessages = {
    SESSION_EXPIRED: 'Session expired. Please start over with /start.',
    RETRY_BUTTON_TEXT: 'Retry',

    enterAddress(): string {
        return (
            '<b>Connect Your Hyperliquid Account</b>\n\n' +
            'Please enter your Hyperliquid account address (starts with 0x):'
        );
    },

    invalidAddress(): string {
        return 'Invalid address format. Please enter a valid Ethereum address (0x followed by 40 hex characters).';
    },

    approveAgent(agentAddress: string, isMainnet: boolean): string {
        const networkName = isMainnet ? 'Mainnet' : 'Testnet';
        return (
            `<b>Approve Agent Wallet (${networkName})</b>\n\n` +
            `An agent wallet has been generated for you. Agent wallets can trade but <b>cannot withdraw funds</b>.\n\n` +
            `<b>Agent Address:</b>\n<code>${agentAddress}</code>\n\n` +
            `To approve the agent:\n` +
            `1. Go to the Hyperliquid API settings page\n` +
            `2. Add the agent address above\n` +
            `3. Click "Done" when finished`
        );
    },

    verifying(): string {
        return 'Verifying agent approval...';
    },

    approvalSuccess(): string {
        return (
            '<b>Account Connected Successfully!</b>\n\n' +
            'Your Hyperliquid account is now connected and ready to use.'
        );
    },

    approvalFailed(): string {
        return (
            'Agent not yet approved. Please make sure you have added the agent address on the Hyperliquid API settings page.\n\n' +
            'Click "Retry" to check again or "Cancel" to abort.'
        );
    },

    cancelled(): string {
        return 'Connection cancelled.';
    },

    whyConnect(): string {
        return (
            '<b>Connect Your Hyperliquid Account</b>\n\n' +
            'To place and cancel orders for you, the bot needs an <b>agent wallet</b> on your Hyperliquid account.\n\n' +
            '<b>Why this is safe</b>\n' +
            '• Agent wallets can <b>trade only</b> — they <b>cannot withdraw</b> your funds\n' +
            '• You approve the agent yourself in the official Hyperliquid app\n' +
            '• You can revoke it any time on the same page — one click\n' +
            '• Your master wallet key is never shared with the bot\n\n' +
            '<a href="https://app.hyperliquid.xyz/API">Open Hyperliquid API page</a>'
        );
    },
};
