import {
  Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards, Ip,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PatientPortalService } from './patient-portal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ClinicalStaff, Public } from '../../common/decorators';

/** Lado da profissional: gera e revoga o acesso do paciente. */
@ApiTags('patient-portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patient-portal')
export class PatientPortalController {
  constructor(private readonly svc: PatientPortalService) {}

  @ClinicalStaff()
  @Post('links')
  @ApiOperation({ summary: 'Gerar link do portal do paciente' })
  async criarLink(@Request() req: any, @Body() dto: any) {
    const { link, token } = await this.svc.criarLink(req.user.workspaceId, req.user.sub, dto);
    return { ...link, token, tokenHash: undefined };
  }

  @ClinicalStaff()
  @Get('links')
  @ApiOperation({ summary: 'Listar links do portal' })
  @ApiQuery({ name: 'patientId', required: false })
  listarLinks(@Request() req: any, @Query('patientId') patientId?: string) {
    return this.svc.listarLinks(req.user.workspaceId, patientId);
  }

  @ClinicalStaff()
  @Patch('links/:id/revogar')
  @ApiOperation({ summary: 'Revogar acesso' })
  revogar(@Request() req: any, @Param('id') id: string) {
    return this.svc.revogarLink(req.user.workspaceId, req.user.sub, id);
  }
}

/**
 * Portal do paciente, sem login.
 *
 * Throttle de 30/min: mais folgado que a anamnese (uso é uma vez) porque aqui
 * a pessoa navega — abre o plano, volta, registra uma refeição, confere a
 * consulta. Ainda assim bem abaixo dos 60 globais, calibrados para app
 * autenticado.
 */
@ApiTags('patient-portal-publico')
@Controller('publico/portal')
export class PatientPortalPublicoController {
  constructor(private readonly svc: PatientPortalService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get(':token')
  @ApiOperation({ summary: 'Abrir o portal pelo link (sem autenticação)' })
  abrir(@Param('token') token: string, @Ip() ip: string) {
    return this.svc.abrirPortal(token, ip);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post(':token/refeicao')
  @ApiOperation({ summary: 'Registrar refeição pelo portal' })
  registrar(@Param('token') token: string, @Body() dto: any) {
    return this.svc.registrarRefeicao(token, dto);
  }
}
