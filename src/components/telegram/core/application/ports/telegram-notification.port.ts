export const TELEGRAM_NOTIFICATION_PORT = Symbol('TELEGRAM_NOTIFICATION_PORT');

export interface TelegramNotificationPort {
    sendMessage(chatId: number, message: string): Promise<void>;
    editMessage(chatId: number, messageId: number, message: string): Promise<void>;
}
