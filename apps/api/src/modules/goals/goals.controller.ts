import {
  Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { PatientGoal } from './patient-goal.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicalStaff } from '../../common/decorators';

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly svc: GoalsService) {}

  @ClinicalStaff()
  @Post()
  create(@Request() req: any, @Body() dto: Partial<PatientGoal>) {
    return this.svc.create(req.user.workspaceId, req.user.sub, dto);
  }

  @ClinicalStaff()
  @Get('patient/:patientId')
  findByPatient(@Request() req: any, @Param('patientId') patientId: string) {
    return this.svc.findByPatient(req.user.workspaceId, patientId);
  }

  @ClinicalStaff()
  @Get('patient/:patientId/summary')
  getSummary(@Request() req: any, @Param('patientId') patientId: string) {
    return this.svc.getSummary(req.user.workspaceId, patientId);
  }

  @ClinicalStaff()
  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.svc.findOne(req.user.workspaceId, id);
  }

  @ClinicalStaff()
  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<PatientGoal>,
  ) {
    return this.svc.update(req.user.workspaceId, id, req.user.sub, dto);
  }

  @ClinicalStaff()
  @Post(':id/checkpoint')
  addCheckpoint(
    @Request() req: any,
    @Param('id') id: string,
    @Body('value') value: number,
    @Body('note') note?: string,
  ) {
    return this.svc.addCheckpoint(req.user.workspaceId, id, req.user.sub, value, note);
  }

  @ClinicalStaff()
  @Patch(':id/achieve')
  markAchieved(@Request() req: any, @Param('id') id: string) {
    return this.svc.markAchieved(req.user.workspaceId, id, req.user.sub);
  }

  @ClinicalStaff()
  @Delete(':id')
  delete(@Request() req: any, @Param('id') id: string) {
    return this.svc.delete(req.user.workspaceId, id, req.user.sub);
  }
}
