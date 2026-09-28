import { Module } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from '../services/idempotency.service';
import { IdempotencyValidator } from './idempotency/idempotency.validator';
import { IdempotencyStateResolver } from './idempotency/idempotency-state.resolver';

@Module({
  providers: [
    IdempotencyInterceptor,
    IdempotencyService,
    IdempotencyValidator,
    IdempotencyStateResolver,
  ],
  exports: [
    IdempotencyInterceptor,
    IdempotencyService,
    IdempotencyValidator,
    IdempotencyStateResolver,
  ],
})
export class IdempotencyModule {}
