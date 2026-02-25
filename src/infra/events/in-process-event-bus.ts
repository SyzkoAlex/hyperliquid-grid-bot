import { Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class InProcessEventBus {
    private readonly logger = logger.child({ context: InProcessEventBus.name });
    private readonly handlers = new Map<
        string,
        Array<(payload: unknown) => void | Promise<void>>
    >();

    async emit(type: string, payload: unknown): Promise<void> {
        const handlers = this.handlers.get(type) ?? [];
        this.logger.debug({ type }, 'Emitting event');
        await Promise.all(
            handlers.map(async (handler) => {
                try {
                    await handler(payload);
                } catch (error) {
                    this.logger.error({ error, type }, 'Error in event handler');
                }
            }),
        );
    }

    on(type: string, handler: (payload: unknown) => void | Promise<void>): () => void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type)!.push(handler);
        this.logger.debug({ type }, 'Handler registered');
        return () => {
            const list = this.handlers.get(type) ?? [];
            const idx = list.indexOf(handler);
            if (idx > -1) list.splice(idx, 1);
        };
    }

    getHandlerCount(type: string): number {
        return this.handlers.get(type)?.length ?? 0;
    }

    clear(type?: string): void {
        if (type) {
            this.handlers.delete(type);
        } else {
            this.handlers.clear();
        }
    }
}
