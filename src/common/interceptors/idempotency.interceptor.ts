import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { IdempotencyValidator } from './idempotency/idempotency.validator';
import { IdempotencyService } from '../services/idempotency.service';
import { IdempotencyStateResolver } from './idempotency/idempotency-state.resolver';
import { IdempotencyRequest } from './idempotency/context/idempotency.context';

//Idempotency entry
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly validator: IdempotencyValidator,
    private readonly idempotencyService: IdempotencyService,
    private readonly stateResolver: IdempotencyStateResolver,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<IdempotencyRequest>();

    // 1. Validate & convert HTTP Request -> Domain Context { userId, key }
    const domainContext = this.validator.validate(request);

    // 2. Query Redis Lock State
    const lockResult = await this.idempotencyService.lockOrGet(
      domainContext.userId,
      domainContext.key,
    );

    // 3. Delegate to Polymorphic State Resolver
    return this.stateResolver.resolve(lockResult, domainContext, next);
  }
}
