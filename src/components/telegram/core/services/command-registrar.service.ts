import { MessageContext } from '../domain/message-context';

export const COMMAND_REGISTRAR = Symbol('CommandRegistrar');

export interface CommandRegistrar {
    onCommand(command: string, handler: (ctx: MessageContext) => Promise<void>): void;
    onAction(action: string, handler: (ctx: MessageContext) => Promise<void>): void;
    launch(): Promise<void>;
}
