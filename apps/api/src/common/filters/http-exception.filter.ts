import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        error = exception.message;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        message = Array.isArray(body['message'])
          ? (body['message'] as string[]).join('; ')
          : String(body['message'] ?? exception.message);
        error = String(body['error'] ?? HttpStatus[status] ?? 'Error');
      } else {
        message = exception.message;
        error = HttpStatus[status] ?? 'Error';
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'Internal Server Error';
      message = 'Erro interno. Tente novamente ou contate o suporte.';
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} → ${status}: ${message}`);
    } else if (status >= 400) {
      this.logger.warn(`${request.method} ${request.url} → ${status}: ${message}`);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
