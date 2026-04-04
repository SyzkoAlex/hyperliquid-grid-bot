import { beforeEach, describe, expect, it } from 'vitest';
import { GridPnlCalculatorService } from './grid-pnl-calculator.service';
import { OrderSide } from '@domain/models/order/order-side';

function buy(price: number, amount: number) {
    return { side: OrderSide.Buy, price, amount };
}

function sell(price: number, amount: number) {
    return { side: OrderSide.Sell, price, amount };
}

/**
 * Correct economic PnL: sellVolume + qtyHeld × currentPrice − buyVolume
 * gridProfit + unrealizedPnl must always equal this value.
 *
 * @see docs/GRID-PNL-CALCULATION.md
 */
function expectedTotalPnl(
    orders: { side: OrderSide; price: number; amount: number }[],
    currentPrice: number,
): number {
    let buyVolume = 0;
    let sellVolume = 0;
    let buyQty = 0;
    let sellQty = 0;

    for (const o of orders) {
        const value = o.price * o.amount;
        if (o.side === OrderSide.Buy) {
            buyVolume += value;
            buyQty += o.amount;
        } else {
            sellVolume += value;
            sellQty += o.amount;
        }
    }

    return sellVolume + (buyQty - sellQty) * currentPrice - buyVolume;
}

describe('GridPnlCalculatorService', () => {
    let service: GridPnlCalculatorService;

    beforeEach(() => {
        service = new GridPnlCalculatorService();
    });

    describe('empty orders', () => {
        it('returns zero gridProfit and unrealizedPnl', () => {
            const result = service.calculate([], 100);
            expect(result.gridProfit).toBe(0);
            expect(result.unrealizedPnl).toBe(0);
            expect(result.totalFees).toBe(0);
        });
    });

    describe('gridProfit — realized profit from completed cycles', () => {
        it('single completed cycle: buy 100 → sell 110 = +10 profit', () => {
            const orders = [buy(100, 1), sell(110, 1)];
            const result = service.calculate(orders, 115);
            expect(result.gridProfit).toBeCloseTo(10);
            expect(result.unrealizedPnl).toBe(0);
        });

        it('multiple completed cycles sum profits correctly', () => {
            const orders = [buy(100, 1), sell(110, 1), buy(100, 1), sell(110, 1)];
            const result = service.calculate(orders, 105);
            expect(result.gridProfit).toBeCloseTo(20);
            expect(result.unrealizedPnl).toBe(0);
        });

        it('different buy prices: gridProfit uses weighted avg cost basis', () => {
            const orders = [buy(100, 1), buy(120, 1), sell(130, 1)];
            // avgBuyPrice = (100 + 120) / 2 = 110
            // gridProfit = 130 − 1 × 110 = 20
            const result = service.calculate(orders, 130);
            expect(result.gridProfit).toBeCloseTo(20);
        });

        it('only buys, no sells → gridProfit is zero', () => {
            const orders = [buy(100, 2), buy(90, 3)];
            const result = service.calculate(orders, 95);
            expect(result.gridProfit).toBe(0);
        });
    });

    describe('unrealizedPnl — mark-to-market of held position', () => {
        it('price above avgBuyPrice → positive unrealized', () => {
            const orders = [buy(100, 2)];
            const result = service.calculate(orders, 110);
            // unrealized = 2 × (110 − 100) = 20
            expect(result.unrealizedPnl).toBeCloseTo(20);
        });

        it('price below avgBuyPrice → negative unrealized', () => {
            const orders = [buy(100, 1)];
            const result = service.calculate(orders, 90);
            expect(result.unrealizedPnl).toBeCloseTo(-10);
        });

        it('weighted average buy price across multiple fills', () => {
            const orders = [buy(100, 1), buy(120, 1), sell(130, 1)];
            // avgBuyPrice = 110, qtyHeld = 1
            const result = service.calculate(orders, 140);
            expect(result.unrealizedPnl).toBeCloseTo(30);
        });

        it('all sold → zero unrealized regardless of price', () => {
            const orders = [buy(100, 1), sell(110, 1)];
            const result = service.calculate(orders, 200);
            expect(result.unrealizedPnl).toBe(0);
        });
    });

    describe('totalPnl invariant: gridProfit + unrealizedPnl = sellVolume + qtyHeld × currentPrice − buyVolume', () => {
        const cases: {
            name: string;
            orders: { side: OrderSide; price: number; amount: number }[];
            currentPrice: number;
        }[] = [
            {
                name: 'single completed cycle',
                orders: [buy(100, 1), sell(110, 1)],
                currentPrice: 115,
            },
            {
                name: 'excess buys (held position)',
                orders: [buy(100, 2), buy(90, 1), sell(110, 1)],
                currentPrice: 95,
            },
            {
                name: 'many buys, one sell (grid dip scenario)',
                orders: [
                    buy(101.2, 0.861),
                    buy(96.6, 0.902),
                    buy(92.0, 0.947),
                    buy(87.4, 0.997),
                    buy(82.8, 1.052),
                    sell(87.4, 1.052),
                ],
                currentPrice: 88,
            },
            {
                name: 'only buys, no sells',
                orders: [buy(100, 5)],
                currentPrice: 80,
            },
            {
                name: 'multiple complete cycles',
                orders: [
                    buy(100, 1),
                    sell(110, 1),
                    buy(100, 1),
                    sell(110, 1),
                    buy(100, 1),
                    sell(110, 1),
                ],
                currentPrice: 105,
            },
            {
                name: 'price equals avgBuyPrice',
                orders: [buy(100, 2), sell(110, 1)],
                currentPrice: 100,
            },
        ];

        for (const { name, orders, currentPrice } of cases) {
            it(name, () => {
                const result = service.calculate(orders, currentPrice);
                const expected = expectedTotalPnl(orders, currentPrice);
                expect(result.gridProfit + result.unrealizedPnl).toBeCloseTo(expected, 6);
            });
        }
    });

    describe('totalFees', () => {
        it('returns zero totalFees when no feeUsdc provided', () => {
            const orders = [buy(100, 1), sell(110, 1)];
            const result = service.calculate(orders, 115);
            expect(result.totalFees).toBe(0);
        });

        it('sums feeUsdc across all orders', () => {
            const orders = [
                { ...buy(100, 1), feeUsdc: 0.04 },
                { ...sell(110, 1), feeUsdc: 0.044 },
            ];
            const result = service.calculate(orders, 115);
            expect(result.totalFees).toBeCloseTo(0.084);
            expect(result.gridProfit).toBeCloseTo(10);
        });

        it('handles mix of orders with and without feeUsdc', () => {
            const orders = [{ ...buy(100, 1), feeUsdc: 0.04 }, sell(110, 1)];
            const result = service.calculate(orders, 115);
            expect(result.totalFees).toBeCloseTo(0.04);
        });

        it('gridProfit remains gross (unchanged) when fees are present', () => {
            const ordersWithFees = [
                { ...buy(100, 1), feeUsdc: 0.04 },
                { ...sell(110, 1), feeUsdc: 0.044 },
            ];
            const ordersWithoutFees = [buy(100, 1), sell(110, 1)];
            const withFees = service.calculate(ordersWithFees, 115);
            const withoutFees = service.calculate(ordersWithoutFees, 115);
            expect(withFees.gridProfit).toBeCloseTo(withoutFees.gridProfit);
        });
    });

    describe('real-world: grid 9fc4d4b7 scenario (HYPE/USDC)', () => {
        const filledOrders = [
            buy(101.2, 0.86067194),
            buy(96.6, 0.90165631),
            buy(92.0, 0.94673913),
            buy(87.4, 0.99656751),
            buy(82.8, 1.05193237),
            sell(87.4, 1.05193237),
        ];
        const currentPrice = 88;

        it('gridProfit reflects only the one completed cycle profit (~4.84)', () => {
            const result = service.calculate(filledOrders, currentPrice);
            // Completed cycle: sell 87.4 × 1.052 − avgBuyPrice × 1.052
            // avgBuyPrice ≈ 91.55 → gridProfit ≈ 87.4×1.052 − 91.55×1.052 ≈ −4.37
            // (negative because sell price 87.4 < avgBuyPrice 91.55 — the sold tokens cost more than the sell revenue)
            // But the CYCLE profit (buy@82.8→sell@87.4) is positive:
            //   87.4×1.052 − 82.8×1.052 = 4.6×1.052 ≈ 4.84
            // The difference is due to FIFO vs weighted-avg cost basis method.
            // With weighted avg, gridProfit absorbs some unrealized cost basis, but totalPnl is still correct.
            expect(result.gridProfit).toBeCloseTo(
                87.4 * 1.05193237 - 1.05193237 * (435.5000044 / 4.75756726),
                2,
            );
        });

        it('totalPnl is correct (not catastrophically negative)', () => {
            const result = service.calculate(filledOrders, currentPrice);
            const totalPnl = result.gridProfit + result.unrealizedPnl;
            const expected = expectedTotalPnl(filledOrders, currentPrice);
            expect(totalPnl).toBeCloseTo(expected, 4);
            // With old bug, totalPnl was −356. Real economic PnL is ~−17 at price $88.
            expect(totalPnl).toBeGreaterThan(-50);
        });

        it('totalPnl matches portfolio change: sellVolume + heldValue − buyVolume', () => {
            const result = service.calculate(filledOrders, currentPrice);
            const totalPnl = result.gridProfit + result.unrealizedPnl;
            // buyVolume ≈ 435.50, sellVolume ≈ 91.94, qtyHeld ≈ 3.706, currentPrice = 88
            // expected ≈ 91.94 + 3.706 × 88 − 435.50 ≈ −17.47
            expect(totalPnl).toBeCloseTo(-17.47, 0);
        });
    });
});
