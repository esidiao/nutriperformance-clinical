import {
  Controller, Get, Post, Patch, Param, Body, Request, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LaboratoryService } from './laboratory.service';
import { LaboratoryExam } from './laboratory-exam.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicalStaff, RequiresTokens } from '../../common/decorators';

@ApiTags('laboratory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('laboratory')
export class LaboratoryController {
  constructor(private readonly svc: LaboratoryService) {}

  @ClinicalStaff()
  @Post()
  create(@Request() req: any, @Body() dto: Partial<LaboratoryExam>) {
    return this.svc.create(req.user.workspaceId, req.user.sub, dto);
  }

  @ClinicalStaff()
  @Get('patient/:patientId')
  findByPatient(@Request() req: any, @Param('patientId') patientId: string) {
    return this.svc.findByPatient(req.user.workspaceId, patientId);
  }

  @ClinicalStaff()
  @Get('patient/:patientId/latest')
  getLatest(@Request() req: any, @Param('patientId') patientId: string) {
    return this.svc.getLatest(req.user.workspaceId, patientId);
  }

  @ClinicalStaff()
  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.svc.findOne(req.user.workspaceId, id, req.user.sub);
  }

  @ClinicalStaff()
  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<LaboratoryExam>,
  ) {
    return this.svc.update(req.user.workspaceId, id, req.user.sub, dto);
  }

  @ClinicalStaff()
  @RequiresTokens('laboratory_analysis')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post(':id/analyze')
  analyze(
    @Request() req: any,
    @Param('id') id: string,
    @Body('supplementContext') supplementContext?: string[],
  ) {
    return this.svc.analyzeWithAi(req.user.workspaceId, id, req.user.sub, supplementContext);
  }
}
