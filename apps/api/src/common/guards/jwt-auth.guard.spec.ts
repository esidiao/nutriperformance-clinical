import { readFileSync } from 'fs';
import { join } from 'path';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard, IS_PUBLIC_KEY } from './jwt-auth.guard';
import { ContasAtivasService } from '../contas-ativas.service';

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
  let contas: { motivoParaNegar: jest.Mock };

  beforeEach(() => {
    reflector = new Reflector();
    // Por padrao a conta esta em ordem, para que os testes de identidade
    // continuem medindo o que mediam.
    contas = { motivoParaNegar: jest.fn().mockResolvedValue(null) };
    guard = new JwtAuthGuard(reflector, contas as unknown as ContasAtivasService);
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

  // --- Conta e workspace ainda valem? --------------------------------------
  //
  // O token prova quem assinou, nao que a conta ainda exista. Enquanto estes
  // testes nao existiam, `users.is_active` e `workspaces.is_active` eram
  // gravados pelo painel e lidos por ninguem.

  it('NEGA quando a conta ou o workspace nao valem mais', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jest.spyOn(guard as any, 'verifyToken').mockResolvedValue({
      sub: 'user-uuid-123',
      app_metadata: { role: 'nutritionist', workspace_id: 'ws-1' },
    });
    contas.motivoParaNegar.mockResolvedValue('conta desativada.');
    const { ctx, request } = makeContext({ authorization: 'Bearer valido' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(/conta desativada/);
    // E nao deixa req.user montado pela metade para um proximo guard usar.
    expect(request.user).toBeUndefined();
  });

  it('confere com o sub do token e o workspace do app_metadata', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jest.spyOn(guard as any, 'verifyToken').mockResolvedValue({
      sub: 'user-uuid-123',
      app_metadata: { role: 'nutritionist', workspace_id: 'ws-1' },
      // O que o atacante grava em si mesmo nao pode escolher qual workspace
      // sera conferido.
      user_metadata: { workspace_id: 'ws-da-vitima' },
    });
    const { ctx } = makeContext({ authorization: 'Bearer valido' });

    await guard.canActivate(ctx);
    expect(contas.motivoParaNegar).toHaveBeenCalledWith('user-uuid-123', 'ws-1');
  });

  it('nao consulta o banco em rota @Public()', async () => {
    // Health check e webhook nao podem depender do banco para responder.
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const { ctx } = makeContext({});
    await guard.canActivate(ctx);
    expect(contas.motivoParaNegar).not.toHaveBeenCalled();
  });

  it('nao consulta o banco quando o token nem e valido', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jest.spyOn(guard as any, 'verifyToken').mockResolvedValue(null);
    const { ctx } = makeContext({ authorization: 'Bearer invalido' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(contas.motivoParaNegar).not.toHaveBeenCalled();
  });

  it('verifica a flag pública usando IS_PUBLIC_KEY', async () => {
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const { ctx } = makeContext({});
    await guard.canActivate(ctx);
    expect(spy).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
  });

  describe('caminho unico de verificacao', () => {
    // O guard aceitava, em paralelo ao JWKS, token HS256 assinado com
    // SUPABASE_JWT_SECRET. Nao era rede de seguranca: era uma segunda
    // autoridade de assinatura. Quem tivesse o segredo legado forjava token
    // valido para qualquer conta, mesmo com a chave assimetrica ativa.
    const fonte = readFileSync(join(__dirname, 'jwt-auth.guard.ts'), 'utf8');
    const codigo = fonte
      .split(/\r?\n/)
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join('\n');

    it('nao importa jsonwebtoken', () => {
      expect(codigo).not.toMatch(/from\s+'jsonwebtoken'/);
    });

    it('nao le SUPABASE_JWT_SECRET', () => {
      // Reintroduzir a variavel no Render nao pode reabrir o caminho: o codigo
      // precisa ignora-la.
      expect(codigo).not.toContain('SUPABASE_JWT_SECRET');
    });

    it('sem JWKS configurado, NEGA em vez de deixar passar', () => {
      // Falta de SUPABASE_URL e erro de configuracao. A resposta certa e negar
      // — antes, sem JWKS, a verificacao caia no ramo HS256.
      expect(codigo).toMatch(/if\s*\(!JWKS\)\s*return null/);
    });
  });
});
