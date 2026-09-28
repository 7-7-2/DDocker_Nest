import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  IdempotencyContext,
  IdempotencyRequest,
} from './context/idempotency.context';

@Injectable()
export class IdempotencyValidator {
  validate(request: IdempotencyRequest): IdempotencyContext {
    const rawKey = request.headers?.['idempotency-key'];
    if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const userId = request.user?.public_id;
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new UnauthorizedException('User not authenticated');
    }

    return {
      userId: userId.trim(),
      key: rawKey.trim(),
    };
  }
}
