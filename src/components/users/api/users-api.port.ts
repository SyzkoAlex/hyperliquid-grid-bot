import { UserDto } from './dto/user.dto';

export const USERS_API_PORT = Symbol('USERS_API_PORT');

export interface UsersApiPort {
    /** Find a user by their UUID. Returns null if not found. */
    findUserById(userId: string): Promise<UserDto | null>;

    /** Find a user by their Telegram chat ID. Returns null if not found. */
    findUserByChatId(chatId: number): Promise<UserDto | null>;

    /** Find a user by their Hyperliquid account address. Returns null if not found. */
    findUserByAccountAddress(accountAddress: string): Promise<UserDto | null>;

    /** Return all users with active accounts. */
    findActiveUsers(): Promise<UserDto[]>;

    /** Return the agent wallet private key for the given user (by userId UUID). */
    getAgentPrivateKey(userId: string): Promise<string>;

    /** Create a user in pending state and return the new user alongside the generated agent wallet address. */
    createPendingUser(
        chatId: number,
        accountAddress: string,
    ): Promise<{ user: UserDto; agentAddress: string }>;

    /** Activate a pending user after the agent wallet is approved on-chain. */
    activateUser(userId: string): Promise<void>;

    /** Disconnect a user and revoke their agent wallet. */
    disconnectUser(userId: string): Promise<void>;

    /** Enable or disable trade notifications for a user. */
    updateTradeNotificationsEnabled(userId: string, enabled: boolean): Promise<void>;

    /** Flip user status to AgentExpired and regenerate a fresh agent keypair. */
    markAgentExpired(userId: string): Promise<{ agentAddress: string }>;
}
