import { describe, it, expect, vi } from 'vitest';
import { TelegramBotService } from './telegram-bot.service';

/**
 * Minimal stub of Telegraf that exposes only the surface used by stopAndWait/launch.
 */
function makeTelegrafStub(launchBehavior: () => Promise<void>) {
    return {
        launch: vi.fn(launchBehavior),
        stop: vi.fn(),
        catch: vi.fn(),
        use: vi.fn(),
    };
}

function makeService(): TelegramBotService {
    const configService = {
        get: vi.fn().mockReturnValue({
            enabled: true,
            botToken: 'test-token',
            allowedUserId: undefined,
        }),
    };
    const sessionStore = {} as never;
    const metrics = {} as never;
    const usersApi = {} as never;

    return new TelegramBotService(configService as never, sessionStore, metrics, usersApi);
}

describe('TelegramBotService', () => {
    describe('stopAndWait', () => {
        it('should resolve immediately when bot is not initialized', async () => {
            const sut = makeService();
            // _bot is not set (onModuleInit not called)
            await expect(sut.stopAndWait()).resolves.toBeUndefined();
        });

        it('should await launchPromise before resolving', async () => {
            const sut = makeService();

            let resolveLaunch!: () => void;
            const launchSettled = vi.fn();

            const stub = makeTelegrafStub(
                () =>
                    new Promise<void>((resolve) => {
                        resolveLaunch = resolve;
                    }),
            );

            // Inject the stub bot directly into the private field
            (sut as unknown as { _bot: typeof stub })._bot = stub;

            // Start launch (does not await — simulates bot.launch() running)
            const launchPromise = sut.launch().then(launchSettled);

            // Give the event loop a tick so launchPromise is stored
            await Promise.resolve();

            // stopAndWait should wait for launchPromise
            const stopPromise = sut.stopAndWait();

            // Neither has settled yet
            expect(launchSettled).not.toHaveBeenCalled();

            // Now resolve the underlying Telegraf launch
            resolveLaunch();

            await stopPromise;
            await launchPromise;

            expect(stub.stop).toHaveBeenCalledTimes(1);
            expect(launchSettled).toHaveBeenCalledTimes(1);
        });

        it('should resolve even when launchPromise rejects', async () => {
            const sut = makeService();

            let rejectLaunch!: (err: Error) => void;
            const stub = makeTelegrafStub(
                () =>
                    new Promise<void>((_, reject) => {
                        rejectLaunch = reject;
                    }),
            );

            (sut as unknown as { _bot: typeof stub })._bot = stub;

            // Start launch and ignore its rejection for this test
            sut.launch().catch(() => {});

            await Promise.resolve();

            const stopPromise = sut.stopAndWait();

            rejectLaunch(new Error('polling aborted'));

            await expect(stopPromise).resolves.toBeUndefined();
        });
    });
});
