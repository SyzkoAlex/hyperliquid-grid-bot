import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserDto } from '@components/users/api/dto/user.dto';
import { WebRequest } from './web-request';

export const CurrentWebUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): UserDto =>
        ctx.switchToHttp().getRequest<WebRequest>().webUser,
);
