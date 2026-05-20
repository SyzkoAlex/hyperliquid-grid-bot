import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TopSymbolsRefreshAdapter } from './top-symbols-refresh.adapter';
import {
    DISTRIBUTED_LOCK_PORT,
    DistributedLockPort,
} from '@/core/application/ports/outbound/distributed-lock.port';
import { RefreshTopSymbolsUseCase } from '@components/trading/core/application/use-cases/refresh-top-symbols/refresh-top-symbols.use-case';

const TOKENS_CONFIG = {
    topSize: 10,
    refreshIntervalMs: 3600000,
    cacheTtlSeconds: 86400,
    lockTtlMs: 60000,
};

describe('TopSymbolsRefreshAdapter (Unit)', () => {
    let module: TestingModule;
    let adapter: TopSymbolsRefreshAdapter;
    let mockLock: DistributedLockPort;
    let mockRefreshUseCase: { execute: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        mockLock = {
            tryAcquire: vi.fn(),
            release: vi.fn(),
            extend: vi.fn(),
            withLock: vi.fn(),
        };

        mockRefreshUseCase = {
            execute: vi.fn().mockResolvedValue(undefined),
        };

        module = await Test.createTestingModule({
            imports: [ScheduleModule.forRoot()],
            providers: [
                TopSymbolsRefreshAdapter,
                { provide: DISTRIBUTED_LOCK_PORT, useValue: mockLock },
                { provide: RefreshTopSymbolsUseCase, useValue: mockRefreshUseCase },
                {
                    provide: ConfigService,
                    useValue: {
                        get: () => TOKENS_CONFIG,
                    },
                },
            ],
        }).compile();

        adapter = module.get(TopSymbolsRefreshAdapter);
    });

    describe('runRefresh', () => {
        it('calls refreshUseCase.execute when lock is acquired', async () => {
            vi.mocked(mockLock.withLock).mockImplementation(async (_name, _ttl, fn) => fn());

            await (adapter as unknown as { runRefresh(): Promise<void> }).runRefresh();

            expect(mockLock.withLock).toHaveBeenCalledWith(
                'top-symbols-refresh',
                TOKENS_CONFIG.lockTtlMs,
                expect.any(Function),
            );
            expect(mockRefreshUseCase.execute).toHaveBeenCalledWith(
                TOKENS_CONFIG.topSize,
                TOKENS_CONFIG.cacheTtlSeconds,
            );
        });

        it('does not call refreshUseCase when withLock returns null', async () => {
            vi.mocked(mockLock.withLock).mockResolvedValue(null);

            await (adapter as unknown as { runRefresh(): Promise<void> }).runRefresh();

            expect(mockLock.withLock).toHaveBeenCalledOnce();
            expect(mockRefreshUseCase.execute).not.toHaveBeenCalled();
        });

        it('catches use case errors without crashing', async () => {
            vi.mocked(mockLock.withLock).mockImplementation(async (_name, _ttl, fn) => fn());
            mockRefreshUseCase.execute.mockRejectedValue(new Error('network error'));

            await expect(
                (adapter as unknown as { runRefresh(): Promise<void> }).runRefresh(),
            ).resolves.not.toThrow();
        });

        it('skips when isRunning flag is already set', async () => {
            (adapter as unknown as { isRunning: boolean }).isRunning = true;

            await (adapter as unknown as { runRefresh(): Promise<void> }).runRefresh();

            expect(mockLock.withLock).not.toHaveBeenCalled();
            expect(mockRefreshUseCase.execute).not.toHaveBeenCalled();

            (adapter as unknown as { isRunning: boolean }).isRunning = false;
        });
    });
});
