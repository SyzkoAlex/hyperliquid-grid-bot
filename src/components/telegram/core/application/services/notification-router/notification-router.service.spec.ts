import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { NotificationRouterService } from './notification-router.service';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';
import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';
import { GridStopLossTriggeredEvent } from '@domain/models/events/trading/grid-stop-loss-triggered.event';
import { GridStatus } from '@domain/models/grid/grid-status';
import { UserStatus } from '@domain/models/user/user-status';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { UserDto } from '@components/users/api/dto/user.dto';
import { GridsApiPort } from '@components/grids/api/grids-api.port';
import { UsersApiPort } from '@components/users/api/users-api.port';

const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const CHAT_ID = 123456789;
const ACCOUNT_ADDRESS = '0x1234567890123456789012345678901234567890';

function makeGridDto(overrides: Partial<GridDto> = {}): GridDto {
    return {
        id: GRID_ID,
        userId: USER_ID,
        symbol: 'BTC',
        status: GridStatus.Running,
        lowerPrice: 45000,
        upperPrice: 55000,
        levels: 10,
        investmentUSDC: 1000,
        investmentBase: 0.1,
        trailingEnabled: false,
        trailingTriggerPercent: 5,
        trailingStepPercent: 2,
        trailingPartialClosePercent: 50,
        stopLossEnabled: false,
        ...overrides,
    };
}

function makeUserDto(overrides: Partial<UserDto> = {}): UserDto {
    return {
        id: USER_ID,
        telegramChatId: CHAT_ID,
        accountAddress: ACCOUNT_ADDRESS,
        agentAddress: '0xagent',
        status: UserStatus.Active,
        timezone: 'UTC',
        tradeNotificationsEnabled: true,
        ...overrides,
    };
}

describe('NotificationRouterService', () => {
    let sut: NotificationRouterService;
    let mockGridsApi: Mocked<Pick<GridsApiPort, 'findGridById'>>;
    let mockUsersApi: Mocked<Pick<UsersApiPort, 'findUserById' | 'findUserByAccountAddress'>>;

    beforeEach(() => {
        mockGridsApi = {
            findGridById: vi.fn().mockResolvedValue(makeGridDto()),
        };
        mockUsersApi = {
            findUserById: vi.fn().mockResolvedValue(makeUserDto()),
            findUserByAccountAddress: vi.fn().mockResolvedValue(makeUserDto()),
        };
        sut = new NotificationRouterService(
            mockGridsApi as unknown as GridsApiPort,
            mockUsersApi as unknown as UsersApiPort,
        );
    });

    describe('resolve', () => {
        it('should return route with chatId and tradeNotificationsEnabled for OrderOpenedEvent when grid and user found', async () => {
            const event = new OrderOpenedEvent(GRID_ID, 'BTC', 'buy', 50000, 0.1, 5000, 1, 10);

            const result = await sut.resolve(event);

            expect(result).toEqual({
                chatId: CHAT_ID,
                tradeNotificationsEnabled: true,
            });
            expect(mockGridsApi.findGridById).toHaveBeenCalledWith(GRID_ID);
            expect(mockUsersApi.findUserById).toHaveBeenCalledWith(USER_ID);
        });

        it('should return null when grid not found for OrderOpenedEvent', async () => {
            mockGridsApi.findGridById.mockResolvedValue(null);
            const event = new OrderOpenedEvent(GRID_ID, 'BTC', 'buy', 50000, 0.1, 5000, 1, 10);

            const result = await sut.resolve(event);

            expect(result).toBeNull();
            expect(mockUsersApi.findUserById).not.toHaveBeenCalled();
        });

        it('should return null when user not found for OrderOpenedEvent', async () => {
            mockUsersApi.findUserById.mockResolvedValue(null);
            const event = new OrderOpenedEvent(GRID_ID, 'BTC', 'buy', 50000, 0.1, 5000, 1, 10);

            const result = await sut.resolve(event);

            expect(result).toBeNull();
        });

        it('should return route for OrderClosedEvent happy path', async () => {
            const event = new OrderClosedEvent(
                GRID_ID,
                'BTC',
                'sell',
                51000,
                0.1,
                5100,
                100,
                2,
                10,
            );

            const result = await sut.resolve(event);

            expect(result).toEqual({ chatId: CHAT_ID, tradeNotificationsEnabled: true });
        });

        it('should return route for GridStopLossTriggeredEvent happy path', async () => {
            const event = new GridStopLossTriggeredEvent(
                GRID_ID,
                'BTC',
                49000,
                48500,
                0.1,
                4850,
                true,
                undefined,
            );

            const result = await sut.resolve(event);

            expect(result).toEqual({ chatId: CHAT_ID, tradeNotificationsEnabled: true });
        });

        it('should return route for GridCreatedSuccessEvent happy path', async () => {
            const event = new GridCreatedSuccessEvent(
                GRID_ID,
                'BTC',
                45000,
                55000,
                10,
                1000,
                0.1,
                false,
            );

            const result = await sut.resolve(event);

            expect(result).toEqual({ chatId: CHAT_ID, tradeNotificationsEnabled: true });
        });

        it('should resolve GridCreatedErrorEvent via findUserByAccountAddress', async () => {
            const event = new GridCreatedErrorEvent('Insufficient balance', ACCOUNT_ADDRESS);

            const result = await sut.resolve(event);

            expect(result).toEqual({ chatId: CHAT_ID, tradeNotificationsEnabled: true });
            expect(mockUsersApi.findUserByAccountAddress).toHaveBeenCalledWith(ACCOUNT_ADDRESS);
            expect(mockGridsApi.findGridById).not.toHaveBeenCalled();
        });

        it('should return null when no user matches accountAddress for GridCreatedErrorEvent', async () => {
            mockUsersApi.findUserByAccountAddress.mockResolvedValue(null);
            const event = new GridCreatedErrorEvent('Insufficient balance', ACCOUNT_ADDRESS);

            const result = await sut.resolve(event);

            expect(result).toBeNull();
        });

        it('should propagate tradeNotificationsEnabled: false from UserDto unchanged', async () => {
            mockUsersApi.findUserById.mockResolvedValue(
                makeUserDto({ tradeNotificationsEnabled: false }),
            );
            const event = new OrderOpenedEvent(GRID_ID, 'BTC', 'buy', 50000, 0.1, 5000, 1, 10);

            const result = await sut.resolve(event);

            expect(result).toEqual({ chatId: CHAT_ID, tradeNotificationsEnabled: false });
        });

        it('should return null for an event with no gridId and no accountAddress path', async () => {
            const unknownEvent = {
                eventType: 'UnknownEvent',
                serialize: () => ({}),
            } as unknown as import('@domain/models/events/trading/trading-event').SerializableEvent;

            const result = await sut.resolve(unknownEvent);

            expect(result).toBeNull();
            expect(mockGridsApi.findGridById).not.toHaveBeenCalled();
            expect(mockUsersApi.findUserById).not.toHaveBeenCalled();
        });
    });
});
