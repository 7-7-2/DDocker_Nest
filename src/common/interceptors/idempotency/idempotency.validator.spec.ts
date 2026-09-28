import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { IdempotencyValidator } from './idempotency.validator';

describe('IdempotencyValidator', () => {
  let validator: IdempotencyValidator;

  beforeEach(() => {
    validator = new IdempotencyValidator();
  });

  it('should be defined', () => {
    expect(validator).toBeDefined();
  });

  it('should throw BadRequestException when Idempotency-Key header is missing', () => {
    expect(() => validator.validate({ headers: {} })).toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when Idempotency-Key header is whitespace only', () => {
    expect(() =>
      validator.validate({
        headers: { 'idempotency-key': '   ' },
        user: { public_id: 'user-1' },
      }),
    ).toThrow(BadRequestException);
  });

  it('should throw UnauthorizedException when request.user is missing', () => {
    expect(() =>
      validator.validate({
        headers: { 'idempotency-key': 'valid-key' },
      }),
    ).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when request.user.public_id is empty', () => {
    expect(() =>
      validator.validate({
        headers: { 'idempotency-key': 'valid-key' },
        user: { public_id: '   ' },
      }),
    ).toThrow(UnauthorizedException);
  });

  it('should return trimmed userId and key on valid input', () => {
    const result = validator.validate({
      headers: { 'idempotency-key': '  test-key-123  ' },
      user: { public_id: '  user-xyz-999  ' },
    });

    expect(result).toEqual({
      userId: 'user-xyz-999',
      key: 'test-key-123',
    });
  });
});
