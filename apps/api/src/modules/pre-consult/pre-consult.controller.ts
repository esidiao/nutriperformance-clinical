import {
  Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PreConsultService } from './pre-consult.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ClinicalStaff, Public } from '../../common/decorators';

/** Rotas autenticadas: a profissional cria e acompanha os formulários. */
@ApiTags('pre-consult')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pre-consult')
export class PreConsultController {
  constructor(private readonly svc: PreConsultService) {}

  @ClinicalStaff()
  @Post()
  @ApiOperation({ summary: 'Gerar link de anamnese pré-consulta' })
  async criar(@Request() req: any, @Body() dto: any) {
    const { form, token } = await this.svc.criar(req.user.workspaceId, req.user.sub, dto);
    // O token sai daqui e nunca mais: o banco guarda só o hash. Se a
    // profissional perder o link, gera outro.
    return { ...form, token, tokenHash: undefined };
  }

  @ClinicalStaff()
  @Get()
  @ApiOperation({ summary: 'Listar formulários' })
  @ApiQuery({ name: 'patientId', required: false })
  listar(@Request() req: any, @Query('patientId') patientId?: string) {
    return this.svc.listar(req.user.workspaceId, patientId);
  }

  @ClinicalStaff()
  @Get(':id')
  @ApiOperation({ summary: 'Formulário e respostas' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.svc.findOneComQuestionario(req.user.workspaceId, id);
  }

  @ClinicalStaff()
  @Patch(':id/cancelar')
  @ApiOperation({ summary: 'Cancelar link' })
  cancelar(@Request() req: any, @Param('id') id: string) {
    return this.svc.cancelar(req.user.workspaceId, req.user.sub, id);
  }
}

/**
 * Rotas públicas: o paciente responde sem login.
 *
 * Throttle apertado — 10 requisições por minuto por IP, contra os 60 globais.
 * O acesso legítimo é uma pessoa abrindo um formulário e enviando uma vez; não
 * existe caso de uso honesto com dezenas de chamadas por minuto, e o limite
 * global foi calibrado para um app autenticado, não para uma porta aberta.
 *
 * Prefixo `publico/` de propósito: quem lê a lista de rotas vê imediatamente
 * o que está exposto sem autenticação.
 */
@ApiTags('pre-consult-publico')
@Controller('publico/anamnese')
export class PreConsultPublicoController {
  constructor(private readonly svc: PreConsultService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get(':token')
  @ApiOperation({ summary: 'Abrir formulário pelo link (sem autenticação)' })
  abrir(@Param('token') token: string) {
    return this.svc.abrirPublico(token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':token')
  @ApiOperation({ summary: 'Enviar respostas (sem autenticação)' })
  responder(@Param('token') token: string, @Body() corpo: unknown) {
    return this.svc.responderPublico(token, corpo);
  }
}
