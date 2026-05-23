import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CanActivate } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

// Supabase issues HS256 JWTs signed with SUPABASE_JWT_SECRET
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

// For Supabase JWT verification — uses HS256 with the JWT secret
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação ausente');
    }

    const token = authHeader.slice(7);

    try {
      const payload = jwt.verify(token, SUPABASE_JWT_SECRET, {
        algorithms: ['HS256'],
        audience: 'authenticated',
      }) as jwt.JwtPayload;

      // Attach user info derived from Supabase JWT claims
      request.user = {
        sub: payload.sub,                                // Supabase user UUID
        email: payload.email,
        role: payload.user_metadata?.role ?? 'nutritionist',
        workspaceId: payload.user_metadata?.workspace_id,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
