import { Controller, Get, Patch, Param, Body, Req, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { ClinicalStaff } from '../../common/decorators';

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
    @Body() body: { note?: string },
    @Req() req: any,
  ) {
    await this.alertsService.resolveAlert(alertId, req.user.id, body.note);
    return { resolved: true, alertId };
  }
}
