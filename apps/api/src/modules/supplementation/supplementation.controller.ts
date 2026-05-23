import {
  Controller, Get, Post, Patch, Param, Body, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SupplementationService } from './supplementation.service';
import { PatientSupplementation } from './patient-supplementation.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicalStaff, RequiresTokens } from '../../common/decorators';

@ApiTags('supplementation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('supplementation')
export class SupplementationController {
  constructor(private readonly svc: SupplementationService) {}

  @ClinicalStaff()
  @Post()
  create(@Request() req: any, @Body() dto: Partial<PatientSupplementation>) {
    return this.svc.create(req.user.workspaceId, req.user.sub, dto);
  }

  @ClinicalStaff()
  @Get('patient/:patientId')
  findByPatient(@Request() req: any, @Param('patientId') patientId: string) {
    return this.svc.findByPatient(req.user.workspaceId, patientId);
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
    @Body() dto: Partial<PatientSupplementation>,
  ) {
    return this.svc.update(req.user.workspaceId, id, req.user.sub, dto);
  }

  @ClinicalStaff()
  @Patch(':id/deactivate')
  deactivate(@Request() req: any, @Param('id') id: string) {
    return this.svc.deactivate(req.user.workspaceId, id, req.user.sub);
  }

  @ClinicalStaff()
  @RequiresTokens('supplementation_analysis')
  @Post('patient/:patientId/analyze')
  analyze(@Request() req: any, @Param('patientId') patientId: string) {
    return this.svc.analyzeWithAi(req.user.workspaceId, patientId, req.user.sub);
  }
}
