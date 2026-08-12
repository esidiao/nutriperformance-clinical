import { Module } from '@nestjs/common';
import { AIEngineService as AiEngineService } from './ai-engine.service';

/**
 * O AIEngineService é sempre consumido por um módulo clínico (interações,
 * biodisponibilidade, laboratório, suplementação), nunca exposto direto por
 * rota. O antigo `POST /ai/stream` aceitava um prompt livre e não passava
 * por @ClinicalStaff nem por @RequiresTokens — qualquer usuário autenticado
 * gerava conteúdo no Gemini sem débito e sem contexto clínico. Foi removido:
 * o streaming real de produção é o `POST /interactions/analyze/stream`, que
 * monta o prompt a partir do DTO validado.
 */
@Module({
  providers: [AiEngineService],
  exports: [AiEngineService],
})
export class AiModule {}
