import { vi } from 'vitest';
import { BotContext } from '../../../types/bot-context';

export function createMockBotContext(
    overrides: {
        accountAddress?: string;
        userId?: number;
    } = {},
): BotContext {
    return {
        session: { createGrid: {} },
        scene: { leave: vi.fn() },
        user: {
            id: overrides.userId ?? 0,
            accountAddress: overrides.accountAddress ?? '0x123',
        },
        reply: vi.fn().mockResolvedValue({ chat: { id: 123 }, message_id: 456 }),
        answerCbQuery: vi.fn().mockResolvedValue(undefined),
        deleteMessage: vi.fn().mockResolvedValue(undefined),
        telegram: {
            editMessageText: vi.fn().mockResolvedValue(undefined),
            deleteMessage: vi.fn().mockResolvedValue(undefined),
        },
    } as unknown as BotContext;
}
