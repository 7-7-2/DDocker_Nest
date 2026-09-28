import { Request } from 'express';

export interface AuthenticatedUser {
  public_id: string;
}

export interface IdempotencyRequest extends Partial<Request> {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

export interface IdempotencyContext {
  userId: string;
  key: string;
}
