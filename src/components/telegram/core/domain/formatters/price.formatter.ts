export class PriceFormatter {
    static format(price: number): string {
        return price.toFixed(2).replace(/\.?0+$/, '');
    }
}
