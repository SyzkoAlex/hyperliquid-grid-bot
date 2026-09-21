import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { exportSPKI, generateKeyPair, KeyLike, SignJWT } from 'jose';
import { UserDto } from '@components/users/api/dto/user.dto';
import { GridSnapshotDto } from '@components/grids/api/dto/grid-snapshot.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { UserStatus } from '@domain/models/user/user-status';
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderType } from '@domain/models/order/order-type';
import { AuthenticateWebUserUseCase } from '../../../core/application/use-cases/authenticate-web-user/authenticate-web-user.use-case';
import { GetMyGridsUseCase } from '../../../core/application/use-cases/get-my-grids/get-my-grids.use-case';
import { GetMyGridUseCase } from '../../../core/application/use-cases/get-my-grid/get-my-grid.use-case';
import { InternalJwtGuard } from './internal-jwt.guard';
import { WebApiAdapter } from './web-api.adapter';

const ISSUER = 'grid-frontend';
const AUDIENCE = 'grid-bot';
const BASE_PATH = '/internal/web/v1';
const GRID_ID = '550e8400-e29b-41d4-a716-446655440000';
const ACTIVE_TELEGRAM_ID = 100000001;
const EXPIRED_TELEGRAM_ID = 100000002;
const SECRET_KEY_PATTERN = /private|secret|key|agent|userId/i;

const activeUser: UserDto = {
    id: 'user-a',
    telegramChatId: ACTIVE_TELEGRAM_ID,
    accountAddress: '0x00000000000000000000000000000000000000aa',
    agentAddress: '0x00000000000000000000000000000000000000bb',
    status: UserStatus.Active,
    timezone: 'UTC',
    tradeNotificationsEnabled: true,
};

const expiredUser: UserDto = {
    ...activeUser,
    id: 'user-b',
    telegramChatId: EXPIRED_TELEGRAM_ID,
    status: UserStatus.AgentExpired,
};

function makeOrder(status: OrderStatus): OrderDto {
    return {
        id: '660e8400-e29b-41d4-a716-446655440001',
        gridId: GRID_ID,
        symbol: 'BTC',
        side: OrderSide.Buy,
        status,
        type: OrderType.Limit,
        orderIndex: 3,
        price: 95000,
        amount: 0.001,
        exchangeOrderId: 'exchange-1',
        createdAt: 1_700_000_000_000,
        placedAt: 1_700_000_001_000,
        filledAt: 1_700_000_002_000,
        cancelledAt: 1_700_000_003_000,
        feeUsdc: 0.05,
    };
}

const snapshot: GridSnapshotDto = {
    grid: {
        id: GRID_ID,
        userId: activeUser.id,
        symbol: 'BTC',
        status: GridStatus.Stopped,
        lowerPrice: 90000,
        upperPrice: 100000,
        orderCount: 10,
        investmentUSDC: 500,
        investmentBase: 0.001,
        creationPrice: 94000,
        trailingEnabled: true,
        trailingTriggerPercent: 5,
        trailingStepPercent: 2,
        trailingPartialClosePercent: 50,
        createdAt: 1_700_000_000_000,
        startedAt: 1_700_000_000_500,
        stoppedAt: 1_700_000_900_000,
        stopPrice: 96000,
        stopLossEnabled: true,
        stopLossPrice: 85000,
        stopLossTriggeredAt: 1_700_000_800_000,
    },
    pnl: { gridProfit: 12.5, unrealizedPnl: -3, totalFees: 0.4 },
    currentPrice: 96000,
    orderStats: {
        activeBuys: 1,
        activeSells: 0,
        avgActiveBuyPrice: 95000,
        avgActiveSellPrice: 0,
        lowestActiveBuyPrice: 95000,
        highestActiveSellPrice: 0,
        filledCycles: 2,
    },
    activeOrders: [makeOrder(OrderStatus.Placed)],
    filledOrders: [makeOrder(OrderStatus.Filled)],
};

interface OpenApiSchema {
    required?: string[];
    properties: Record<string, unknown>;
}

const openApi = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'docs', 'internal-web-api.openapi.json'), 'utf8'),
) as { components: { schemas: Record<string, OpenApiSchema> } };

function expectMatchesSchema(body: Record<string, unknown>, schemaName: string): void {
    const schema = openApi.components.schemas[schemaName];
    expect(Object.keys(body).sort()).toEqual(Object.keys(schema.properties).sort());
    for (const field of schema.required ?? []) {
        expect(body).toHaveProperty(field);
    }
}

function collectKeys(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(collectKeys);
    if (value && typeof value === 'object') {
        return Object.entries(value).flatMap(([k, v]) => [k, ...collectKeys(v)]);
    }
    return [];
}

describe('WebApiAdapter (Integration)', () => {
    let app: INestApplication;
    let baseUrl: string;
    let privateKey: KeyLike;
    const authenticate = { execute: vi.fn() };
    const getMyGrids = { execute: vi.fn() };
    const getMyGrid = { execute: vi.fn() };

    function sign(
        claims: Record<string, unknown> = { telegramId: ACTIVE_TELEGRAM_ID },
        options: { issuer?: string; audience?: string; iat?: number; exp?: number } = {},
    ): Promise<string> {
        const now = Math.floor(Date.now() / 1000);
        return new SignJWT(claims)
            .setProtectedHeader({ alg: 'EdDSA' })
            .setIssuer(options.issuer ?? ISSUER)
            .setAudience(options.audience ?? AUDIENCE)
            .setIssuedAt(options.iat ?? now)
            .setExpirationTime(options.exp ?? now + 120)
            .sign(privateKey);
    }

    function get(route: string, token?: string, scheme = 'Bearer'): Promise<Response> {
        const headers: Record<string, string> = token
            ? { Authorization: `${scheme} ${token}` }
            : {};
        return fetch(`${baseUrl}${BASE_PATH}${route}`, { headers });
    }

    beforeAll(async () => {
        const keyPair = await generateKeyPair('EdDSA');
        privateKey = keyPair.privateKey;
        const publicKeyPem = await exportSPKI(keyPair.publicKey);

        const config = {
            get: vi.fn().mockReturnValue({
                enabled: true,
                jwtPublicKey: publicKeyPem.replace(/\n/g, '\\n'),
                jwtIssuer: ISSUER,
                jwtAudience: AUDIENCE,
            }),
        };

        const module = await Test.createTestingModule({
            controllers: [WebApiAdapter],
            providers: [
                InternalJwtGuard,
                { provide: ConfigService, useValue: config },
                { provide: AuthenticateWebUserUseCase, useValue: authenticate },
                { provide: GetMyGridsUseCase, useValue: getMyGrids },
                { provide: GetMyGridUseCase, useValue: getMyGrid },
            ],
        }).compile();

        app = module.createNestApplication({ logger: false });
        await app.listen(0, '127.0.0.1');
        baseUrl = await app.getUrl();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        authenticate.execute.mockImplementation(async (telegramId: number) => {
            if (telegramId === ACTIVE_TELEGRAM_ID) return activeUser;
            if (telegramId === EXPIRED_TELEGRAM_ID) return expiredUser;
            return null;
        });
        getMyGrids.execute.mockResolvedValue({
            items: [snapshot],
            totalCount: 1,
            currentPage: 1,
        });
        getMyGrid.execute.mockResolvedValue(snapshot);
    });

    describe('authentication', () => {
        it('rejects a request without an Authorization header', async () => {
            expect((await get('/me')).status).toBe(401);
        });

        it('rejects a non-Bearer scheme', async () => {
            expect((await get('/me', await sign(), 'Basic')).status).toBe(401);
        });

        it('rejects a garbage token', async () => {
            expect((await get('/me', 'not-a-jwt')).status).toBe(401);
        });

        it('rejects an expired token', async () => {
            const now = Math.floor(Date.now() / 1000);
            const token = await sign(undefined, { iat: now - 600, exp: now - 300 });

            expect((await get('/me', token)).status).toBe(401);
        });

        it('rejects a token without exp', async () => {
            const token = await new SignJWT({ telegramId: ACTIVE_TELEGRAM_ID })
                .setProtectedHeader({ alg: 'EdDSA' })
                .setIssuer(ISSUER)
                .setAudience(AUDIENCE)
                .setIssuedAt()
                .sign(privateKey);

            expect((await get('/me', token)).status).toBe(401);
        });

        it('rejects a token older than 5 minutes even if not expired', async () => {
            const now = Math.floor(Date.now() / 1000);
            const token = await sign(undefined, { iat: now - 600, exp: now + 600 });

            expect((await get('/me', token)).status).toBe(401);
        });

        it('rejects a wrong audience', async () => {
            expect((await get('/me', await sign(undefined, { audience: 'other' }))).status).toBe(
                401,
            );
        });

        it('rejects a wrong issuer', async () => {
            expect((await get('/me', await sign(undefined, { issuer: 'other' }))).status).toBe(401);
        });

        it('rejects a token signed with another algorithm', async () => {
            const rsa = await generateKeyPair('RS256');
            const now = Math.floor(Date.now() / 1000);
            const token = await new SignJWT({ telegramId: ACTIVE_TELEGRAM_ID })
                .setProtectedHeader({ alg: 'RS256' })
                .setIssuer(ISSUER)
                .setAudience(AUDIENCE)
                .setIssuedAt(now)
                .setExpirationTime(now + 120)
                .sign(rsa.privateKey);

            expect((await get('/me', token)).status).toBe(401);
        });

        it('rejects a token without telegramId', async () => {
            expect((await get('/me', await sign({}))).status).toBe(401);
        });

        it('rejects a non-integer telegramId', async () => {
            expect((await get('/me', await sign({ telegramId: '100000001' }))).status).toBe(401);
            expect((await get('/me', await sign({ telegramId: 1.5 }))).status).toBe(401);
        });

        it('rejects an unknown or non-whitelisted user', async () => {
            const response = await get('/me', await sign({ telegramId: 42 }));

            expect(response.status).toBe(401);
            expect(authenticate.execute).toHaveBeenCalledWith(42);
        });
    });

    describe('GET /me', () => {
        it('returns the connected user', async () => {
            const response = await get('/me', await sign());
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toEqual({
                telegramId: ACTIVE_TELEGRAM_ID,
                status: UserStatus.Active,
                accountAddress: activeUser.accountAddress,
                isConnected: true,
            });
            expectMatchesSchema(body, 'WebUserDto');
        });

        it('returns isConnected=false for an agent_expired user', async () => {
            const response = await get('/me', await sign({ telegramId: EXPIRED_TELEGRAM_ID }));
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.status).toBe(UserStatus.AgentExpired);
            expect(body.isConnected).toBe(false);
        });
    });

    describe('GET /grids', () => {
        it('lists the grids of the authenticated user with default paging', async () => {
            const response = await get('/grids', await sign());
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(getMyGrids.execute).toHaveBeenCalledWith(activeUser.id, undefined, 1, 20);
            expectMatchesSchema(body, 'WebGridsPageDto');
            expectMatchesSchema(body.items[0], 'WebGridDto');
            expectMatchesSchema(body.items[0].pnl, 'GridPnlDto');
            expectMatchesSchema(body.items[0].orderStats, 'OrderStatsDto');
        });

        it('passes status, page and pageSize through', async () => {
            const response = await get('/grids?status=running&page=3&pageSize=50', await sign());

            expect(response.status).toBe(200);
            expect(getMyGrids.execute).toHaveBeenCalledWith(
                activeUser.id,
                GridStatus.Running,
                3,
                50,
            );
        });

        it.each(['pageSize=500', 'pageSize=0', 'page=0', 'page=abc', 'status=bogus'])(
            'returns 400 for invalid query %s',
            async (query) => {
                const response = await get(`/grids?${query}`, await sign());

                expect(response.status).toBe(400);
                expect(getMyGrids.execute).not.toHaveBeenCalled();
            },
        );
    });

    describe('GET /grids/:id', () => {
        it('returns the grid detail with orders', async () => {
            const response = await get(`/grids/${GRID_ID}`, await sign());
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(getMyGrid.execute).toHaveBeenCalledWith(activeUser.id, GRID_ID);
            expectMatchesSchema(body, 'WebGridDetailDto');
            expectMatchesSchema(body.activeOrders[0], 'WebOrderDto');
            expectMatchesSchema(body.filledOrders[0], 'WebOrderDto');
        });

        it('returns 404 for a foreign or unknown grid', async () => {
            getMyGrid.execute.mockResolvedValue(null);

            const response = await get(`/grids/${GRID_ID}`, await sign());

            expect(response.status).toBe(404);
        });

        it('returns 404 for a malformed id without calling the use case', async () => {
            const response = await get('/grids/not-a-uuid', await sign());

            expect(response.status).toBe(404);
            expect(getMyGrid.execute).not.toHaveBeenCalled();
        });
    });

    it('never exposes secret or internal fields', async () => {
        const token = await sign();
        const bodies = await Promise.all(
            ['/me', '/grids', `/grids/${GRID_ID}`].map(async (route) =>
                (await get(route, token)).json(),
            ),
        );

        for (const key of collectKeys(bodies)) {
            expect(key).not.toMatch(SECRET_KEY_PATTERN);
        }
        expect(JSON.stringify(bodies)).not.toContain('exchange-1');
    });
});
