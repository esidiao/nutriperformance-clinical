import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProgressPhotosService } from './progress-photos.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ClinicalStaff, Public } from '../../common/decorators';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';

/**
 * Fotos de evolucao corporal.
 *
 * NAO existe rota publica aqui, e a ausencia e deliberada: o paciente nao envia
 * nem ve foto corporal por link. Um link pode ser encaminhado, e imagem de
 * corpo e o conteudo mais sensivel do sistema. Enquanto nao houver conta de
 * paciente, o envio fica com quem tem login.
 */
@ApiTags('progress-photos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('progress-photos')
export class ProgressPhotosController {
  constructor(private readonly svc: ProgressPhotosService) {}

  @ClinicalStaff()
  @Post()
  @ApiOperation({ summary: 'Registrar foto e obter URL de envio' })
  criar(@Request() req: any, @Body() dto: any) {
    return this.svc.criar(req.user.workspaceId, req.user.sub, dto);
  }

  @ClinicalStaff()
  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Fotos do paciente agrupadas por ângulo' })
  listar(@Request() req: any, @Param('patientId') patientId: string) {
    return this.svc.listar(req.user.workspaceId, patientId);
  }

  @ClinicalStaff()
  @Patch(':id/observacao')
  @ApiOperation({ summary: 'Anotar sobre a foto' })
  anotar(@Request() req: any, @Param('id') id: string, @Body() body: { observacao: string }) {
    return this.svc.anotar(req.user.workspaceId, req.user.sub, id, body?.observacao);
  }

  @ClinicalStaff()
  @Delete(':id')
  @ApiOperation({ summary: 'Apagar a foto definitivamente' })
  remover(@Request() req: any, @Param('id') id: string) {
    return this.svc.remover(req.user.workspaceId, req.user.sub, id);
  }
}

/** Expurgo pela retencao, disparado por agendador externo. */
@ApiTags('progress-photos-retencao')
@Controller('progress-photos')
export class ProgressPhotosRetencaoController {
  constructor(private readonly svc: ProgressPhotosService) {}

  @Public()
  @UseGuards(CronSecretGuard)
  @Post('expurgo')
  @ApiOperation({ summary: 'Apagar fotos além da retenção (job agendado)' })
  @ApiQuery({ name: 'simular', required: false })
  expurgar(@Query('simular') simular?: string, @Query('meses') meses?: string) {
    return this.svc.expurgar({
      simular: simular === 'true',
      meses: meses ? Number(meses) : undefined,
    });
  }
}
