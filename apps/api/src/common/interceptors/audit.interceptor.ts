import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../modules/audit/audit.service';

/**
 * Interceptor que registra automaticamente chamadas de API mutantes (POST/PATCH/DELETE)
 * nos logs de auditoria — atende requisito LGPD de rastreabilidade.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = req.method as string;

    // Apenas operações mutantes
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const user = req.user;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          if (!user) return;
          const action = method === 'POST' ? 'CREATE'
            : method === 'DELETE' ? 'DELETE' : 'UPDATE';

          this.auditService.log({
            workspaceId: user.workspaceId,
            userId: user.id,
            action,
            resource: req.path,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            success: true,
          });
        },
        error: (err) => {
          if (!user) return;
          this.auditService.log({
            workspaceId: user.workspaceId,
            userId: user.id,
            action: 'CREATE',
            resource: req.path,
            ipAddress: req.ip,
            success: false,
            changes: { error: err?.message },
          });
        },
      }),
    );
  }
}
