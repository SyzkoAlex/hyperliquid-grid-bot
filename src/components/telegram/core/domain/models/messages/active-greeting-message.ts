export class ActiveGreetingMessage {
    readonly text: string;

    private constructor(username?: string) {
        this.text = username ? `Welcome back, @${username}!` : 'Welcome back!';
    }

    static create(params: { username?: string } = {}): ActiveGreetingMessage {
        return new ActiveGreetingMessage(params.username);
    }
}
