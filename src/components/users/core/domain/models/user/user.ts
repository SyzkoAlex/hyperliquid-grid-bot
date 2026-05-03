import { UserStatus } from '@domain/models/user/user-status';
import { UserCreateParams } from './user-create-params';

export class User {
    private readonly _id: string;
    private readonly _telegramChatId: number;
    private readonly _accountAddress: string;
    private readonly _agentAddress: string;
    private readonly _status: UserStatus;
    private readonly _createdAt: Date;

    private constructor(params: UserCreateParams) {
        this._id = params.id;
        this._telegramChatId = params.telegramChatId;
        this._accountAddress = params.accountAddress;
        this._agentAddress = params.agentAddress;
        this._status = params.status;
        this._createdAt = params.createdAt;
    }

    static create(params: UserCreateParams): User {
        return new User(params);
    }

    get id(): string {
        return this._id;
    }

    get telegramChatId(): number {
        return this._telegramChatId;
    }

    get accountAddress(): string {
        return this._accountAddress;
    }

    get agentAddress(): string {
        return this._agentAddress;
    }

    get status(): UserStatus {
        return this._status;
    }

    get createdAt(): Date {
        return this._createdAt;
    }

    equals(other: User): boolean {
        return this._id === other._id;
    }
}
