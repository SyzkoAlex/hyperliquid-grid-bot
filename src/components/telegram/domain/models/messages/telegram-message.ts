export abstract class TelegramMessage {
    protected abstract readonly text: string;

    toString(): string {
        return this.text;
    }
}
