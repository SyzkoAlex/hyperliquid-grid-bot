import {
    CanActivate,
    ExecutionContext,
    Injectable,
    OnModuleInit,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importSPKI, jwtVerify, KeyLike } from 'jose';
import { Config } from '@/config/config.schema';
import { logger } from '@/infra/logger/logger';
import { AuthenticateWebUserUseCase } from '../../../core/application/use-cases/authenticate-web-user/authenticate-web-user.use-case';
import { WebRequest } from './web-request';

const BEARER_PREFIX = 'Bearer ';

/**
 * Authenticates website requests: verifies an EdDSA-signed JWT (issuer, audience, exp, age ≤ 5 min)
 * carrying a numeric `telegramId` claim, then resolves the bot user. Any failure → 401.
 */
@Injectable()
export class InternalJwtGuard implements CanActivate, OnModuleInit {
    private readonly logger = logger.child({ context: InternalJwtGuard.name });
    private readonly publicKeyPem: string;
    private publicKey!: KeyLike;
    private readonly issuer: string;
    private readonly audience: string;

    constructor(
        private readonly authenticateWebUser: AuthenticateWebUserUseCase,
        config: ConfigService<Config, true>,
    ) {
        const webApi = config.get('webApi', { infer: true });
        this.issuer = webApi.jwtIssuer;
        this.audience = webApi.jwtAudience;
        this.publicKeyPem = webApi.jwtPublicKey.replace(/\\n/g, '\n');
    }

    async onModuleInit(): Promise<void> {
        this.publicKey = await importSPKI(this.publicKeyPem, 'EdDSA');
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<WebRequest>();
        const telegramId = await this.verifyToken(request.headers.authorization);
        const user = await this.authenticateWebUser.execute(telegramId);
        if (!user) {
            this.logger.warn({ telegramId }, 'Web API access denied: unknown or not allowed user');
            throw new UnauthorizedException();
        }
        request.webUser = user;
        return true;
    }

    private async verifyToken(header: string | undefined): Promise<number> {
        if (!header?.startsWith(BEARER_PREFIX)) {
            this.logger.warn('Web API access denied: missing bearer token');
            throw new UnauthorizedException();
        }
        try {
            const { payload } = await jwtVerify(
                header.slice(BEARER_PREFIX.length),
                this.publicKey,
                {
                    algorithms: ['EdDSA'],
                    issuer: this.issuer,
                    audience: this.audience,
                    requiredClaims: ['exp'],
                    maxTokenAge: '5m',
                    clockTolerance: 30,
                },
            );
            const telegramId = payload.telegramId;
            if (typeof telegramId !== 'number' || !Number.isSafeInteger(telegramId)) {
                throw new Error('telegramId claim is missing or not an integer');
            }
            return telegramId;
        } catch (error) {
            // Never log the error object itself: jose claim errors carry the decoded token payload.
            const reason = error instanceof Error ? error.message : String(error);
            const code = error instanceof Error ? (error as { code?: string }).code : undefined;
            this.logger.warn({ reason, code }, 'Web API access denied: invalid token');
            throw new UnauthorizedException();
        }
    }
}
