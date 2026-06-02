import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CanActivate } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import * as jwt from 'jsonwebtoken';

// =============================================================================
// Supabase JWT verification
// -----------------------------------------------------------------------------
// Supabase migrated to ASYMMETRIC signing keys (ES256/RS256). Access tokens are
// now signed with a private key and must be verified against the project's
// public JWKS endpoint — NOT with a shared HS256 secret.
//
// This guard verifies via JWKS first (the current system) and falls back to the
// legacy HS256 shared-secret path for older projects that still issue HS256
// tokens, so it works regardless of which signing scheme the project uses.
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? '';

// Remote JWKS set (cached + auto-refreshed internally by jose).
const JWKS = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const meta = (payload.user_metadata as Record<string, unknown> | undefined) ?? {};

    // Attach user info derived from Supabase JWT claims.
    // NOTE: vários controllers usam `req.user.id` — expomos `id` (= sub) além
    // de `sub` para evitar `created_by`/audit indefinidos.
    request.user = {
      sub: payload.sub, // Supabase user UUID
      id: payload.sub,
      email: (payload as Record<string, unknown>).email,
      role: (meta.role as string) ?? 'nutritionist',
      workspaceId: meta.workspace_id,
    };

    return true;
  }

  private async verifyToken(token: string): Promise<JWTPayload | null> {
    // 1) Asymmetric keys (ES256/RS256) via JWKS — the current Supabase system.
    if (JWKS) {
      try {
        const { payload } = await jwtVerify(token, JWKS, { audience: 'authenticated' });
        return payload;
      } catch {
        // fall through to legacy HS256 attempt
      }
    }

    // 2) Legacy HS256 shared secret — only for projects still issuing HS256.
    if (SUPABASE_JWT_SECRET) {
      try {
        return jwt.verify(token, SUPABASE_JWT_SECRET, {
          algorithms: ['HS256'],
          audience: 'authenticated',
        }) as JWTPayload;
      } catch {
        return null;
      }
    }

    return null;
  }
}
