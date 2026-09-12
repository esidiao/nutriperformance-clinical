import { Reflector } from '@nestjs/core';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard, IS_PUBLIC_KEY } from './jwt-auth.guard';

function makeContext(headers: Record<string, string>): { ctx: ExecutionContext; request: any } {
  const request: any = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  it('permite rotas marcadas com @Public() sem token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const { ctx } = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejeita quando o header Authorization está ausente', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const { ctx } = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita quando o header não começa com "Bearer "', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const { ctx } = makeContext({ authorization: 'Token abc' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita quando o token é inválido (verifyToken retorna null)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jest.spyOn(guard as any, 'verifyToken').mockResolvedValue(null);
    const { ctx } = makeContext({ authorization: 'Bearer invalido' });
    await expect(guard.canActivate(ctx)).rejects.toThrow('Token inválido ou expirado');
  });

  it('popula req.user com id=sub, role e workspaceId a partir do app_metadata', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jest.spyOn(guard as any, 'verifyToken').mockResolvedValue({
      sub: 'user-uuid-123',
      email: 'pro@clinica.com',
      app_metadata: { role: 'fitness_professional', workspace_id: 'ws-9' },
    });
    const { ctx, request } = makeContext({ authorization: 'Bearer valido' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual({
      sub: 'user-uuid-123',
      id: 'user-uuid-123',
      email: 'pro@clinica.com',
      role: 'fitness_professional',
      workspaceId: 'ws-9',
    });
  });

  // ─── Escalada de privilégio ────────────────────────────────────────────────
  //
  // `user_metadata` é gravável pelo próprio dono do token
  // (`supabase.auth.updateUser({ data })`); `app_metadata` exige service-role.
  // Estes dois testes são o que impede a regressão.

  it('IGNORA role e workspace_id vindos de user_metadata', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jest.spyOn(guard as any, 'verifyToken').mockResolvedValue({
      sub: 'user-uuid-123',
      email: 'estagiario@clinica.com',
      // O que o atacante grava em si mesmo:
      user_metadata: { role: 'admin', workspace_id: 'ws-da-vitima' },
      // O que o sistema realmente definiu:
      app_metadata: { role: 'supervised_student', workspace_id: 'ws-proprio' },
    });
    const { ctx, request } = makeContext({ authorization: 'Bearer valido' });

    await guard.canActivate(ctx);
    expect(request.user.role).toBe('supervised_student');
    expect(request.user.workspaceId).toBe('ws-proprio');
  });

  it('NEGA acesso quando só user_metadata traz a identidade', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jest.spyOn(guard as any, 'verifyToken').mockResolvedValue({
      sub: 'user-uuid-456',
      user_metadata: { role: 'admin', workspace_id: 'ws-qualquer' },
      app_metadata: {},
    });
    const { ctx } = makeContext({ authorization: 'Bearer valido' });

    // Falha fechado: sem identidade no lugar confiável, não entra. Antes havia
    // um `?? 'nutritionist'` aqui, que dava papel clínico a conta sem metadado.
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('NEGA acesso quando falta o workspace, mesmo com role válido', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jest.spyOn(guard as any, 'verifyToken').mockResolvedValue({
      sub: 'user-uuid-789',
      app_metadata: { role: 'nutritionist' },
    });
    const { ctx } = makeContext({ authorization: 'Bearer valido' });

    // Sem workspaceId todo filtro multi-tenant dos serviços viraria `undefined`.
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('verifica a flag pública usando IS_PUBLIC_KEY', async () => {
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const { ctx } = makeContext({});
    await guard.canActivate(ctx);
    expect(spy).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
  });
});
