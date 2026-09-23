import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

// Marca rotas como públicas (sem necessidade de JWT). Usado pelo @Public().
export const IS_PUBLIC_KEY = 'isPublic';

// =============================================================================
// Supabase JWT verification
// -----------------------------------------------------------------------------
// Supabase migrated to ASYMMETRIC signing keys (ES256/RS256). Access tokens are
// now signed with a private key and must be verified against the project's
// public JWKS endpoint — NOT with a shared HS256 secret.
//
// Este guard verifica SOMENTE pelo JWKS.
//
// Havia um segundo caminho, HS256 com `SUPABASE_JWT_SECRET` compartilhado, para
// projetos que ainda emitissem token simetrico. Ele foi removido em 23/09/2026
// porque nao era rede de seguranca: era uma segunda autoridade de assinatura
// aceita em paralelo. Qualquer um com o segredo legado forjava token valido
// para qualquer conta, mesmo com a chave assimetrica ativa.
//
// Verificado antes de remover (`scripts/provar-jwks.mjs`): os tokens emitidos
// hoje sao ES256 e o JWKS sozinho os valida, com app_metadata intacto. Se um
// dia o projeto voltar a emitir HS256, o lugar de tratar isso e aqui, com a
// decisao explicita — nao com um fallback silencioso que ninguem lembra que
// existe.
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';

// Remote JWKS set (cached + auto-refreshed internally by jose).
const JWKS = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Rotas marcadas com @Public() não exigem autenticação (health, webhooks).
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação ausente');
    }

    const token = authHeader.slice(7);
    const payload = await this.verifyToken(token);

    if (!payload) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    // ─── Identidade: app_metadata, NUNCA user_metadata ───────────────────────
    //
    // `user_metadata` é gravável pelo PRÓPRIO usuário: com o access token dele,
    // um `supabase.auth.updateUser({ data: { ... } })` reescreve o campo. Só
    // `app_metadata` exige a service-role key.
    //
    // Enquanto `role` e `workspace_id` saíam de `user_metadata`, qualquer conta
    // autenticada conseguia:
    //   - `updateUser({ data: { role: 'admin' } })`      → entrar em @PlatformAdminOnly()
    //   - `updateUser({ data: { workspace_id: <alheio> } })` → ler e escrever o
    //     prontuário de outra clínica.
    //
    // O isolamento multi-tenant do resto do sistema é consistente: todo serviço
    // filtra por `req.user.workspaceId`. Era justamente isso que a falha
    // anulava, porque deixava o atacante ESCOLHER o workspaceId injetado aqui.
    const meta = (payload.app_metadata as Record<string, unknown> | undefined) ?? {};
    const role = meta.role as string | undefined;
    const workspaceId = meta.workspace_id as string | undefined;

    // Falha fechado, e o default sumiu de propósito.
    //
    // Antes havia `?? 'nutritionist'`: uma conta sem metadado nenhum nascia com
    // papel clínico. Agora, sem identidade em app_metadata o acesso é negado —
    // um token válido prova quem você é, não o que você pode fazer.
    //
    // ⚠️ ORDEM DE IMPLANTAÇÃO: rodar `scripts/migrar-identidade-app-metadata.mjs`
    // ANTES de subir esta versão. Ele copia role/workspace_id de user_metadata
    // para app_metadata em todas as contas. Sem isso, ninguém entra.
    if (!role || !workspaceId) {
      throw new UnauthorizedException(
        'Conta sem identidade de acesso configurada. Contate o administrador ' +
        'do sistema para vincular seu perfil e workspace.',
      );
    }

    // Attach user info derived from Supabase JWT claims.
    // NOTE: vários controllers usam `req.user.id` — expomos `id` (= sub) além
    // de `sub` para evitar `created_by`/audit indefinidos.
    request.user = {
      sub: payload.sub, // Supabase user UUID
      id: payload.sub,
      email: (payload as Record<string, unknown>).email,
      role,
      workspaceId,
    };

    return true;
  }

  private async verifyToken(token: string): Promise<JWTPayload | null> {
    // Chaves assimetricas (ES256/RS256) via JWKS. Sem SUPABASE_URL nao ha como
    // verificar nada, e ai a resposta certa e negar — nao deixar passar.
    if (!JWKS) return null;
    try {
      const { payload } = await jwtVerify(token, JWKS, { audience: 'authenticated' });
      return payload;
    } catch {
      return null;
    }
  }
}
