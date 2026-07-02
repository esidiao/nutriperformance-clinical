import { Controller, Get, Patch, Param, Body, Req, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AlertsService } from './alerts.service';
import { ClinicalStaff } from '../../common/decorators';

class ResolveAlertDto {
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get(':patientId')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Alertas clínicos do paciente' })
  async getAlerts(
    @Param('patientId') patientId: string,
    @Query('includeResolved') includeResolved = false,
  ) {
    return this.alertsService.getPatientAlerts(patientId, includeResolved === true || includeResolved === 'true' as any);
  }

  @Patch(':alertId/resolve')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Registrar resolução de alerta' })
  async resolve(
    @Param('alertId') alertId: string,
    @Body() dto: ResolveAlertDto,
    @Req() req: any,
  ) {
    // Frontend envia `notes`; antes a controller lia `note` (singular) e a
    // nota de resolução era perdida silenciosamente. Corrigido aqui.
    await this.alertsService.resolveAlert(alertId, req.user.id, dto.notes);
    return { resolved: true, alertId };
  }
}
