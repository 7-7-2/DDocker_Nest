import { ConflictException, CallHandler } from '@nestjs/common';
import { IdempotencyStateResolver } from './idempotency-state.resolver';
import { IdempotencyService } from '../../services/idempotency.service';
import { IdempotencyContext } from './context/idempotency.context';
import { Mock } from '../../../test-utils/types';
import { of, throwError, lastValueFrom } from 'rxjs';

describe('IdempotencyStateResolver', () => {
  let resolver: IdempotencyStateResolver;
  let service: Mock<IdempotencyService>;

  const context: IdempotencyContext = { userId: 'user-1', key: 'key-1' };

  beforeEach(() => {
    service = {
      saveResponse: jest.fn(),
      rollback: jest.fn(),
    };
    resolver = new IdempotencyStateResolver(
      service as unknown as IdempotencyService,
    );
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should throw ConflictException (409) when state is PENDING', () => {
    const handler: CallHandler<unknown> = { handle: jest.fn() };

    expect(() =>
      resolver.resolve({ state: 'PENDING' }, context, handler),
    ).toThrow(ConflictException);
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('should return cached response observable when state is COMPLETED', async () => {
    const handler: CallHandler<unknown> = { handle: jest.fn() };
    const cachedResponse = { success: true, intakeId: 88 };

    const result$ = resolver.resolve(
      { state: 'COMPLETED', response: cachedResponse },
      context,
      handler,
    );
    const result = await lastValueFrom(result$);

    expect(result).toEqual(cachedResponse);
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('should execute next.handle() and commit response when state is ACQUIRED', async () => {
    const handlerResult = { success: true, intakeId: 10 };
    const handler: CallHandler<typeof handlerResult> = {
      handle: jest.fn(() => of(handlerResult)),
    };

    const result$ = resolver.resolve({ state: 'ACQUIRED' }, context, handler);
    const result = await lastValueFrom(result$);

    expect(handler.handle).toHaveBeenCalled();
    expect(service.saveResponse).toHaveBeenCalledWith(
      'user-1',
      'key-1',
      handlerResult,
    );
    expect(result).toEqual(handlerResult);
    expect(service.rollback).not.toHaveBeenCalled();
  });

  it('should rollback key and re-throw error when handler fails during ACQUIRED', async () => {
    const error = new Error('DB Error');
    const handler: CallHandler<never> = {
      handle: jest.fn(() => throwError(() => error)),
    };
    service.rollback!.mockResolvedValue(undefined);

    const result$ = resolver.resolve({ state: 'ACQUIRED' }, context, handler);
    await expect(lastValueFrom(result$)).rejects.toThrow('DB Error');

    expect(service.rollback).toHaveBeenCalledWith('user-1', 'key-1');
    expect(service.saveResponse).not.toHaveBeenCalled();
  });
});
