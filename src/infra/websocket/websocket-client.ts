import WebSocket from 'ws';
import { logger } from '@/infra/logger/logger';

export interface WebSocketConfig {
    url: string;
    maxReconnectAttempts: number;
    baseReconnectDelay: number;
    keepAlive?: {
        intervalMs: number;
        message: unknown;
    };
}

type MessageHandler = (message: any) => void;

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private readonly logger = logger.child({ context: WebSocketClient.name });
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private keepAliveInterval: NodeJS.Timeout | null = null;
    private reconnectAttempts = 0;
    private isIntentionallyClosed = false;
    private messageHandlers: Set<MessageHandler> = new Set();
    private onOpenCallback?: () => void;

    constructor(private readonly config: WebSocketConfig) {}

    connect(): void {
        if (this.ws) {
            return;
        }

        this.logger.info({ wsUrl: this.config.url }, 'Connecting to WebSocket');

        this.ws = new WebSocket(this.config.url);

        this.ws.on('open', () => {
            this.logger.info('WebSocket connected');
            this.reconnectAttempts = 0;
            this.startKeepAlive();
            this.onOpenCallback?.();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
            try {
                const message = JSON.parse(data.toString());
                this.messageHandlers.forEach((handler) => {
                    try {
                        handler(message);
                    } catch (error) {
                        this.logger.error({ error }, 'Error in message handler');
                    }
                });
            } catch (error) {
                this.logger.error({ error }, 'Failed to parse WebSocket message');
            }
        });

        this.ws.on('error', (error) => {
            this.logger.error({ error }, 'WebSocket error');
        });

        this.ws.on('close', (code, reason) => {
            this.logger.warn({ code, reason: reason.toString() }, 'WebSocket closed');
            this.ws = null;
            this.stopKeepAlive();

            if (!this.isIntentionallyClosed) {
                this.scheduleReconnect();
            }
        });
    }

    disconnect(): void {
        this.isIntentionallyClosed = true;
        this.stopKeepAlive();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    send(data: any): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.logger.warn('WebSocket not connected, cannot send message');
            return;
        }

        this.ws.send(JSON.stringify(data));
    }

    onMessage(handler: MessageHandler): () => void {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    onOpen(callback: () => void): void {
        this.onOpenCallback = callback;
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    private startKeepAlive(): void {
        const { keepAlive } = this.config;
        if (!keepAlive) return;

        this.stopKeepAlive();
        this.keepAliveInterval = setInterval(() => {
            this.logger.trace('Sending keepalive ping');
            this.send(keepAlive.message);
        }, keepAlive.intervalMs);
    }

    private stopKeepAlive(): void {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            this.logger.error('Max reconnect attempts reached, giving up');
            return;
        }

        this.reconnectAttempts++;

        const delay = this.config.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        this.logger.info(
            { attempt: this.reconnectAttempts, delayMs: delay },
            'Scheduling WebSocket reconnect',
        );

        this.reconnectTimeout = setTimeout(() => {
            this.connect();
        }, delay);
    }
}
