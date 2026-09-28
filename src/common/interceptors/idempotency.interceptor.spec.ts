import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from '../services/idempotency.service';
import { IdempotencyValidator } from './idempotency/idempotency.validator';
import { IdempotencyStateResolver } from './idempotency/idempotency-state.resolver';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { of, throwError, lastValueFrom, Observable } from 'rxjs';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let idempotencyService: jest.Mocked<IdempotencyService>;
  let validator: jest.Mocked<IdempotencyValidator>;
  let stateResolver: jest.Mocked<IdempotencyStateResolver>;

  const mockUser = { public_id: 'user-uuid-1' };
  const mockKey = 'idempotency-key-abc';

  const createMockContext = (
    headers: Record<string, string | undefined>,
    user: typeof mockUser | null = mockUser,
  ): ExecutionContext => {
    const request = {
      headers,
      user,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  const createMockCallHandler = (result$: Observable<any>): CallHandler => ({
    handle: jest.fn(() => result$),
  });

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<IdempotencyService>> = {
      lockOrGet: jest.fn(),
      saveResponse: jest.fn(),
      rollback: jest.fn(),
    };

    const validatorMock = {
      validate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyInterceptor,
        IdempotencyStateResolver,
        {
          provide: IdempotencyValidator,
          useValue: validatorMock,
        },
        {
          provide: IdempotencyService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    interceptor = module.get<IdempotencyInterceptor>(IdempotencyInterceptor);
    idempotencyService = module.get(IdempotencyService);

    validator = module.get(IdempotencyValidator);
    validator.validate.mockReturnValue({
      userId: mockUser.public_id,
      key: mockKey,
    });

    stateResolver = module.get(IdempotencyStateResolver);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('Header & Auth Validation', () => {
    it('should throw BadRequestException when Idempotency-Key header is missing', async () => {
      const context = createMockContext({});
      const handler = createMockCallHandler(of({ success: true }));

      validator.validate.mockImplementation(() => {
        throw new BadRequestException('Idempotency-Key header is required');
      });

      await expect(interceptor.intercept(context, handler)).rejects.toThrow(
        BadRequestException,
      );

      expect(validator.validate).toHaveBeenCalled();
      expect(handler.handle).not.toHaveBeenCalled();
      expect(idempotencyService.lockOrGet).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when request.user is not populated', async () => {
      const context = createMockContext({ 'idempotency-key': mockKey }, null);
      const handler = createMockCallHandler(of({ success: true }));

      validator.validate.mockImplementation(() => {
        throw new UnauthorizedException('User is required');
      });

      await expect(interceptor.intercept(context, handler)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(validator.validate).toHaveBeenCalled();
      expect(handler.handle).not.toHaveBeenCalled();
      expect(idempotencyService.lockOrGet).not.toHaveBeenCalled();
    });
  });

  describe('Branch 1: New Request (Lock Acquired -> Handler Succeeds -> Save Response)', () => {
    it('should acquire lock, invoke next.handle(), save response, and emit result', async () => {
      const context = createMockContext({ 'idempotency-key': mockKey });
      const handlerResult = { success: true, intakeId: 101 };
      const handler = createMockCallHandler(of(handlerResult));

      idempotencyService.lockOrGet.mockResolvedValue({ state: 'ACQUIRED' });
      idempotencyService.saveResponse.mockResolvedValue();

      const result$ = await interceptor.intercept(context, handler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual(handlerResult);
      expect(idempotencyService.lockOrGet).toHaveBeenCalledWith(
        mockUser.public_id,
        mockKey,
      );
      expect(handler.handle).toHaveBeenCalledTimes(1);
      expect(idempotencyService.saveResponse).toHaveBeenCalledWith(
        mockUser.public_id,
        mockKey,
        handlerResult,
      );
    });
  });

  describe('Branch 2: Concurrent Request (Lock exists & PENDING -> 409 Conflict)', () => {
    it('should throw ConflictException (409) when lock state is PENDING', async () => {
      const context = createMockContext({ 'idempotency-key': mockKey });
      const handler = createMockCallHandler(of({ success: true }));

      idempotencyService.lockOrGet.mockResolvedValue({ state: 'PENDING' });

      await expect(interceptor.intercept(context, handler)).rejects.toThrow(
        ConflictException,
      );
      expect(handler.handle).not.toHaveBeenCalled();
      expect(idempotencyService.saveResponse).not.toHaveBeenCalled();
    });
  });

  describe('Branch 3: Replay Request (Lock exists & COMPLETED -> Return Cached)', () => {
    it('should return cached response directly without calling next.handle()', async () => {
      const context = createMockContext({ 'idempotency-key': mockKey });
      const cachedResponse = { success: true, cached: true, intakeId: 42 };
      const handler = createMockCallHandler(of({ success: true }));

      idempotencyService.lockOrGet.mockResolvedValue({
        state: 'COMPLETED',
        response: cachedResponse,
      });

      const result$ = await interceptor.intercept(context, handler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual(cachedResponse);
      expect(handler.handle).not.toHaveBeenCalled();
      expect(idempotencyService.saveResponse).not.toHaveBeenCalled();
    });
  });

  describe('Branch 4: Handler Error (Lock Acquired -> Handler Throws -> Rollback Lock)', () => {
    it('should call rollback() and rethrow error when handler fails', async () => {
      const context = createMockContext({ 'idempotency-key': mockKey });
      const error = new Error('Database transaction failed');
      const handler = createMockCallHandler(throwError(() => error));

      idempotencyService.lockOrGet.mockResolvedValue({ state: 'ACQUIRED' });
      idempotencyService.rollback.mockResolvedValue(undefined);

      const result$ = await interceptor.intercept(context, handler);
      await expect(lastValueFrom(result$)).rejects.toThrow(
        'Database transaction failed',
      );

      expect(idempotencyService.rollback).toHaveBeenCalledWith(
        mockUser.public_id,
        mockKey,
      );
      expect(idempotencyService.saveResponse).not.toHaveBeenCalled();
    });
  });
});
