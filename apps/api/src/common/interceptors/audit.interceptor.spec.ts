import { of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';

function ctx(method: string, path = '/patients/abc') {
  const req = {
    method,
    path,
    ip: '10.0.0.1',
    headers: { 'user-agent': 'jest' },
    user: { id: 'auth-uid', workspaceId: 'ws-1' },
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

describe('AuditInterceptor', () => {
  let auditService: any;
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    auditService = { log: jest.fn() };
    interceptor = new AuditInterceptor(auditService);
  });

  it('ignora requisições de leitura (GET)', (done) => {
    interceptor.intercept(ctx('GET'), { handle: () => of('ok') }).subscribe(() => {
      expect(auditService.log).not.toHaveBeenCalled();
      done();
    });
  });

  it.each([
    ['POST', 'CREATE'],
    ['PATCH', 'UPDATE'],
    ['PUT', 'UPDATE'],
    ['DELETE', 'DELETE'],
  ])('registra %s como ação %s no sucesso', async (method, expected) => {
    await new Promise<void>((resolve) =>
      interceptor.intercept(ctx(method), { handle: () => of('ok') }).subscribe(() => resolve()),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: expected, success: true }),
    );
  });

  it.each([
    ['POST', 'CREATE'],
    ['PATCH', 'UPDATE'],
    ['DELETE', 'DELETE'],
  ])('registra %s como ação %s também na falha', async (method, expected) => {
    await new Promise<void>((resolve) =>
      interceptor
        .intercept(ctx(method), { handle: () => throwError(() => new Error('boom')) })
        .subscribe({ error: () => resolve() }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expected,
        success: false,
        changes: { error: 'boom' },
      }),
    );
  });

  it('propaga ip, user-agent e workspace na falha', (done) => {
    interceptor
      .intercept(ctx('DELETE'), { handle: () => throwError(() => new Error('x')) })
      .subscribe({
        error: () => {
          expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              workspaceId: 'ws-1',
              userId: 'auth-uid',
              ipAddress: '10.0.0.1',
              userAgent: 'jest',
            }),
          );
          done();
        },
      });
  });

  it('não registra nada quando não há usuário autenticado', (done) => {
    const anonCtx = {
      switchToHttp: () => ({ getRequest: () => ({ method: 'POST', path: '/x', headers: {} }) }),
    } as any;
    interceptor.intercept(anonCtx, { handle: () => of('ok') }).subscribe(() => {
      expect(auditService.log).not.toHaveBeenCalled();
      done();
    });
  });
});
