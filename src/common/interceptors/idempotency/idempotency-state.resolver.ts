import { Injectable, ConflictException, CallHandler } from '@nestjs/common';
import { Observable, of, from, throwError } from 'rxjs';
import { concatMap, catchError, mergeMap } from 'rxjs/operators';
import {
  LockResult,
  IdempotencyService,
} from '../../services/idempotency.service';
import { IdempotencyContext } from './context/idempotency.context';

export type StateStrategy<K extends LockResult['state']> = (
  result: Extract<LockResult, { state: K }>,
  context: IdempotencyContext,
  next: CallHandler,
) => Observable<unknown>;
@Injectable()
export class IdempotencyStateResolver {
  constructor(private readonly service: IdempotencyService) {}

  private readonly strategies: {
    [K in LockResult['state']]: StateStrategy<K>;
  } = {
    PENDING: () => {
      throw new ConflictException(
        'A request with this idempotency key is currently being processed',
      );
    },

    COMPLETED: (result) => {
      return of(result.response);
    },

    ACQUIRED: (_result, context, next) => {
      return next.handle().pipe(
        concatMap(async (response: unknown) => {
          await this.service.saveResponse(
            context.userId,
            context.key,
            response,
          );
          return response;
        }),
        catchError((error: unknown) =>
          from(this.service.rollback(context.userId, context.key)).pipe(
            mergeMap(() => throwError(() => error)),
          ),
        ),
      );
    },
  };

  resolve(
    result: LockResult,
    context: IdempotencyContext,
    next: CallHandler,
  ): Observable<unknown> {
    const strategy = this.strategies[result.state] as StateStrategy<
      LockResult['state']
    >;
    return strategy(result as never, context, next);
  }
}
