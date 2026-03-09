import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface NestErrorResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

interface ParsedException {
  status: number;
  message: string;
  isCritical: boolean;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, isCritical } = this.parseException(exception);

    this.log(exception, request, status, isCritical);

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }

  private parseException(exception: unknown): ParsedException {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        message: this.extractMessage(exception.getResponse()),
        isCritical: status >= 500,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      isCritical: true,
    };
  }

  private isNestErrorResponse(
    response: unknown,
  ): response is NestErrorResponse {
    return (
      response !== null &&
      typeof response === 'object' &&
      !Array.isArray(response)
    );
  }

  private extractMessage(response: unknown): string {
    if (typeof response === 'string') {
      return response;
    }

    if (this.isNestErrorResponse(response)) {
      const { message } = response;
      if (Array.isArray(message)) {
        return message[0] ?? 'Unknown error';
      }
      return typeof message === 'string' ? message : 'Unexpected error format';
    }

    return 'Unexpected error format';
  }

  private isError(exception: unknown): exception is Error {
    return exception instanceof Error;
  }

  private log(
    exception: unknown,
    request: Request,
    status: number,
    isCritical: boolean,
  ): void {
    const { url, method } = request;

    if (!isCritical) {
      this.logger.warn({ url, method, status }, 'Client Exception');
      return;
    }

    this.logger.error(
      {
        url,
        method,
        status,
        stack: this.isError(exception) ? exception.stack : undefined,
      },
      'Critical Exception',
    );
  }
}
