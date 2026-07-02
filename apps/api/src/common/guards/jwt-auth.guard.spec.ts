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

  it('popula req.user com id=sub, role e workspaceId a partir do payload', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jest.spyOn(guard as any, 'verifyToken').mockResolvedValue({
      sub: 'user-uuid-123',
      email: 'pro@clinica.com',
      user_metadata: { role: 'fitness_professional', workspace_id: 'ws-9' },
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

  it('usa role padrão "nutritionist" quando user_metadata não traz role', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jest.spyOn(guard as any, 'verifyToken').mockResolvedValue({
      sub: 'user-uuid-456',
      user_metadata: {},
    });
    const { ctx, request } = makeContext({ authorization: 'Bearer valido' });

    await guard.canActivate(ctx);
    expect(request.user.role).toBe('nutritionist');
    expect(request.user.id).toBe('user-uuid-456');
  });

  it('verifica a flag pública usando IS_PUBLIC_KEY', async () => {
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const { ctx } = makeContext({});
    await guard.canActivate(ctx);
    expect(spy).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
  });
});
