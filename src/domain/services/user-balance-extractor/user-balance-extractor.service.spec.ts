import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Decimal } from '@domain/models/primitives/decimal';
import { UserBalanceExtractorService } from './user-balance-extractor.service';
import { UserState } from '@domain/models/user-state/user-state';
import { AssetPosition } from '@domain/models/user-state/asset-position';

describe('UserBalanceExtractorService', () => {
    let service: UserBalanceExtractorService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [UserBalanceExtractorService],
        }).compile();

        service = module.get<UserBalanceExtractorService>(UserBalanceExtractorService);
    });

    describe('extractBalances', () => {
        it('should extract USDC and base token balances', () => {
            const btcPosition = AssetPosition.create({
                symbol: TradingSymbol.create('BTC'),
                size: Decimal.from(0.15),
            });

            const userState = UserState.create({
                withdrawableBalance: Decimal.from(5000.5),
                assetPositions: [btcPosition],
            });

            const result = service.extractBalances(userState, 'BTC');

            expect(result.usdcBalance.toNumber()).toBe(5000.5);
            expect(result.baseBalance.toNumber()).toBe(0.15);
        });

        it('should return zero USDC balance when withdrawable is zero', () => {
            const userState = UserState.create({
                withdrawableBalance: Decimal.zero(),
                assetPositions: [],
            });

            const result = service.extractBalances(userState, 'BTC');

            expect(result.usdcBalance.toNumber()).toBe(0);
        });

        it('should return zero base balance when symbol not found', () => {
            const ethPosition = AssetPosition.create({
                symbol: TradingSymbol.create('ETH'),
                size: Decimal.from(10),
            });

            const userState = UserState.create({
                withdrawableBalance: Decimal.from(5000),
                assetPositions: [ethPosition],
            });

            const result = service.extractBalances(userState, 'BTC');

            expect(result.usdcBalance.toNumber()).toBe(5000);
            expect(result.baseBalance.toNumber()).toBe(0);
        });

        it('should handle empty asset positions', () => {
            const userState = UserState.create({
                withdrawableBalance: Decimal.from(5000),
                assetPositions: [],
            });

            const result = service.extractBalances(userState, 'BTC');

            expect(result.usdcBalance.toNumber()).toBe(5000);
            expect(result.baseBalance.toNumber()).toBe(0);
        });
    });
});
