import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';
import { ClinicalStaff, Public } from '../../common/decorators';
import { RagService } from './rag.service';
import { RagSyncService } from './rag-sync.service';

class AskDto {
  @IsString() @MinLength(3) @MaxLength(500) question: string;
}

class SyncDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(500) @IsOptional() limit = 100;
}

@ApiTags('assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assistant')
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly ragSyncService: RagSyncService,
  ) {}

  @Post('ask')
  @ClinicalStaff()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Pergunta nutricional em linguagem natural (RAG, respostas com fonte) — consome 5 tokens' })
  ask(@Body() dto: AskDto, @Req() req: any) {
    return this.ragService.ask({
      question: dto.question,
      workspaceId: req.user.workspaceId,
      userId: req.user.id,
    });
  }

  /**
   * Dispara o sync do RAG sob demanda.
   *
   * O `@Cron(EVERY_WEEK)` do RagSyncService só roda com o processo vivo, e no
   * plano gratuito do Render a instância hiberna sem tráfego — na prática o
   * agendamento semanal não dispara. Quem aciona é o workflow
   * `.github/workflows/rag-sync.yml`, semanalmente.
   *
   * Autenticada por segredo compartilhado (`X-Cron-Secret`) em vez de JWT: um
   * agendador não sustenta um token do Supabase, que expira em ~1h. `@Public()`
   * é obrigatório para escapar do JwtAuthGuard global — o CronSecretGuard passa
   * a ser a única barreira e falha fechado se `CRON_SECRET` não estiver setado.
   */
  @Post('sync')
  @Public()
  @UseGuards(CronSecretGuard)
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @ApiOperation({ summary: 'Indexa no RAG os alimentos ainda sem chunk (idempotente) — requer X-Cron-Secret' })
  async sync(@Body() dto: SyncDto) {
    const result = await this.ragSyncService.syncMissingFoods(dto.limit);
    return result ?? { skipped: true, reason: 'Sync já em execução' };
  }
}
