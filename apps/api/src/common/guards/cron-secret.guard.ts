import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

export const CRON_SECRET_HEADER = 'x-cron-secret';

/**
 * Autentica jobs agendados externos (GitHub Actions) por segredo compartilhado.
 *
 * A rota precisa ser `@Public()` para escapar do JwtAuthGuard global — guards de
 * rota rodam DEPOIS dos globais no Nest, então não há como um guard adicional
 * contornar a exigência de JWT. Como consequência, este guard é a única barreira
 * da rota e **falha fechado**: sem `CRON_SECRET` no ambiente, nada passa.
 *
 * Um agendador não consegue sustentar um JWT do Supabase (expira em ~1h), e
 * guardar e-mail/senha de um admin no CI seria pior: daria acesso à UI inteira
 * e quebraria a cada troca de senha.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.CRON_SECRET;

    // Sem segredo configurado a rota fica fechada, nunca aberta.
    if (!expected) {
      throw new UnauthorizedException('Execução agendada não está habilitada neste ambiente');
    }

    const req = context.switchToHttp().getRequest();
    const provided = req.headers?.[CRON_SECRET_HEADER];

    if (typeof provided !== 'string' || !safeEqual(provided, expected)) {
      throw new UnauthorizedException('Segredo de execução agendada inválido');
    }

    return true;
  }
}

/** Comparação de tempo constante — não vaza o prefixo correto por timing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // timingSafeEqual exige o mesmo tamanho; comparar contra o próprio buffer
  // mantém o custo constante mesmo quando os tamanhos diferem.
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
