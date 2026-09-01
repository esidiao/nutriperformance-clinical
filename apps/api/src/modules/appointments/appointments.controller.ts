import {
  Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ClinicalStaff } from '../../common/decorators';

/**
 * Agenda de consultas. ClinicalStaff e nao NutritionistOnly: agendar nao e ato
 * privativo, e o educador fisico tem a propria agenda.
 */
@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly svc: AppointmentsService) {}

  @ClinicalStaff()
  @Post()
  @ApiOperation({ summary: 'Agendar consulta' })
  create(@Request() req: any, @Body() dto: any) {
    return this.svc.create(req.user.workspaceId, req.user.sub, dto);
  }

  @ClinicalStaff()
  @Get()
  @ApiOperation({ summary: 'Consultas num intervalo (padrão: próximos 7 dias)' })
  @ApiQuery({ name: 'de', required: false })
  @ApiQuery({ name: 'ate', required: false })
  @ApiQuery({ name: 'profissionalId', required: false })
  @ApiQuery({ name: 'patientId', required: false })
  listar(
    @Request() req: any,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('profissionalId') profissionalId?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.svc.listar(req.user.workspaceId, { de, ate, profissionalId, patientId });
  }

  @ClinicalStaff()
  @Get('horarios-livres')
  @ApiOperation({ summary: 'Horários livres de um profissional num dia' })
  @ApiQuery({ name: 'dia', required: true, description: 'ISO 8601' })
  @ApiQuery({ name: 'duracaoMin', required: false })
  @ApiQuery({ name: 'profissionalId', required: false })
  horariosLivres(
    @Request() req: any,
    @Query('dia') dia: string,
    @Query('duracaoMin') duracaoMin?: string,
    @Query('profissionalId') profissionalId?: string,
  ) {
    return this.svc.horariosLivres(
      req.user.workspaceId,
      profissionalId ?? req.user.sub,
      dia,
      duracaoMin ? parseInt(duracaoMin, 10) : undefined,
    );
  }

  @ClinicalStaff()
  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da consulta' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.svc.findOne(req.user.workspaceId, id);
  }

  @ClinicalStaff()
  @Patch(':id')
  @ApiOperation({ summary: 'Remarcar ou editar consulta' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.update(req.user.workspaceId, req.user.sub, id, dto);
  }

  @ClinicalStaff()
  @Patch(':id/status')
  @ApiOperation({ summary: 'Confirmar, marcar presença, falta ou cancelar' })
  mudarStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { status: string; motivo?: string },
  ) {
    return this.svc.mudarStatus(
      req.user.workspaceId, req.user.sub, id, body?.status, body?.motivo,
    );
  }
}
