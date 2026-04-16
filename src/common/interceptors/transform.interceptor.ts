import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  success: boolean;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const isSse = request.headers.accept === 'text/event-stream';

    return next.handle().pipe(
      map((data) => {
        if (isSse && data?.type === 'ping') {
          return data;
        }
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
