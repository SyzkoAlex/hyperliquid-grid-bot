import { Injectable } from '@nestjs/common';

const KNOWN_UNIT_DISPLAY_NAMES: Record<string, string> = {
    Bitcoin: 'BTC',
    Ethereum: 'ETH',
    Solana: 'SOL',
    Dogecoin: 'DOGE',
};

@Injectable()
export class TokenDisplayResolverService {
    resolve(token: { name: string; fullName: string | null }): string {
        if (token.fullName?.startsWith('Unit ')) {
            const stripped = token.fullName.slice('Unit '.length);
            return KNOWN_UNIT_DISPLAY_NAMES[stripped] ?? stripped;
        }
        return token.name;
    }
}
