import { IncomingMessage } from 'node:http';
import { UserDto } from '@components/users/api/dto/user.dto';

export interface WebRequest extends IncomingMessage {
    webUser: UserDto;
}
