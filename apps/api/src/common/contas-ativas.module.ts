import { Global, Module } from '@nestjs/common';
import { ContasAtivasService } from './contas-ativas.service';

/**
 * `@Global()` porque o `JwtAuthGuard` e registrado como `APP_GUARD` no modulo
 * raiz e o painel administrativo precisa da MESMA instancia para limpar o
 * cache ao suspender um workspace. Duas instancias dariam dois caches, e
 * limpar um deixaria o outro servindo "ativo" por mais 30 segundos.
 */
@Global()
@Module({
  providers: [ContasAtivasService],
  exports: [ContasAtivasService],
})
export class ContasAtivasModule {}
