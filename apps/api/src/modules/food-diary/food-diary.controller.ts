import {
  Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FoodDiaryService } from './food-diary.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ClinicalStaff, Public } from '../../common/decorators';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';

/** Lado da profissional: gera o link e acompanha o diário. */
@ApiTags('food-diary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('food-diary')
export class FoodDiaryController {
  constructor(private readonly svc: FoodDiaryService) {}

  @ClinicalStaff()
  @Post('links')
  @ApiOperation({ summary: 'Gerar link do diário alimentar' })
  async criarLink(@Request() req: any, @Body() dto: any) {
    const { link, token } = await this.svc.criarLink(req.user.workspaceId, req.user.sub, dto);
    // Token sai daqui e nunca mais — o banco guarda só o hash.
    return { ...link, token, tokenHash: undefined };
  }

  @ClinicalStaff()
  @Get('links')
  @ApiOperation({ summary: 'Listar links' })
  @ApiQuery({ name: 'patientId', required: false })
  listarLinks(@Request() req: any, @Query('patientId') patientId?: string) {
    return this.svc.listarLinks(req.user.workspaceId, patientId);
  }

  @ClinicalStaff()
  @Patch('links/:id/revogar')
  @ApiOperation({ summary: 'Revogar link' })
  revogar(@Request() req: any, @Param('id') id: string) {
    return this.svc.revogarLink(req.user.workspaceId, req.user.sub, id);
  }

  @ClinicalStaff()
  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Registros do paciente com adesão do período' })
  @ApiQuery({ name: 'de', required: false })
  @ApiQuery({ name: 'ate', required: false })
  registros(
    @Request() req: any,
    @Param('patientId') patientId: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.svc.listarRegistros(req.user.workspaceId, patientId, { de, ate });
  }

  @ClinicalStaff()
  @Patch('entries/:id/comentario')
  @ApiOperation({ summary: 'Comentar um registro' })
  comentar(@Request() req: any, @Param('id') id: string, @Body() body: { comentario: string }) {
    return this.svc.comentar(req.user.workspaceId, req.user.sub, id, body?.comentario);
  }
}

/**
 * Expurgo de fotos pela retenção de 12 meses.
 *
 * Rota separada e disparada por agendador externo, como o sync do RAG: o
 * @Cron in-process não roda porque a instância do plano gratuito hiberna.
 *
 * `@Public()` é obrigatório para escapar do JwtAuthGuard global — guards de
 * rota rodam depois dos globais. O CronSecretGuard vira a única barreira e
 * falha fechado: sem CRON_SECRET no ambiente, ninguém passa.
 */
@ApiTags('food-diary-retencao')
@Controller('food-diary')
export class FoodDiaryRetencaoController {
  constructor(private readonly svc: FoodDiaryService) {}

  @Public()
  @UseGuards(CronSecretGuard)
  @Post('expurgo')
  @ApiOperation({ summary: 'Apagar fotos além da retenção (job agendado)' })
  @ApiQuery({ name: 'simular', required: false, description: 'true = só relata, não apaga' })
  @ApiQuery({ name: 'meses', required: false })
  expurgar(@Query('simular') simular?: string, @Query('meses') meses?: string) {
    return this.svc.expurgarFotosAntigas({
      simular: simular === 'true',
      meses: meses ? Number(meses) : undefined,
    });
  }
}

/**
 * Superfície pública: o paciente registra pelo link, sem login.
 *
 * Throttle de 20/min — mais folgado que a anamnese (10/min) porque aqui o uso
 * legítimo é abrir, enviar, abrir de novo para conferir; e mais apertado que
 * os 60 globais, que foram calibrados para app autenticado.
 */
@ApiTags('food-diary-publico')
@Controller('publico/diario')
export class FoodDiaryPublicoController {
  constructor(private readonly svc: FoodDiaryService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get(':token')
  @ApiOperation({ summary: 'Abrir o diário pelo link (sem autenticação)' })
  abrir(@Param('token') token: string) {
    return this.svc.abrirPublico(token);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post(':token')
  @ApiOperation({ summary: 'Registrar refeição (sem autenticação)' })
  registrar(@Param('token') token: string, @Body() dto: any) {
    return this.svc.registrarPublico(token, dto);
  }
}
