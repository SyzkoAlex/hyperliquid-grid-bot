export const NOTIFICATION_SERVICE = Symbol('NotificationService');

export interface NotificationService {
    sendMessage(chatId: number, message: string): Promise<void>;
}
