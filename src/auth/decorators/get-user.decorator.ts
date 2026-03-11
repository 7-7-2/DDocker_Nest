import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRow } from '../../modules/user/entities/user.entity';

export const GetUser = createParamDecorator(
  (data: keyof UserRow | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: UserRow }>();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
