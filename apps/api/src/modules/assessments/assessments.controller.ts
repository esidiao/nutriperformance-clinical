import {
  Controller, Get, Post, Patch, Param, Body, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AssessmentsService } from './assessments.service';
import { NutritionalAssessment } from './nutritional-assessment.entity';
import { PhysicalAssessment } from './physical-assessment.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NutritionistOnly, FitnessProfessionalOnly, RequiresTokens } from '../../common/decorators';

@ApiTags('assessments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly svc: AssessmentsService) {}

  // ── Nutritional ──────────────────────────────────────────────────────────

  @NutritionistOnly()
  @Post('nutritional')
  createNutritional(
    @Request() req: any,
    @Body() dto: Partial<NutritionalAssessment>,
  ) {
    return this.svc.createNutritional(req.user.workspaceId, req.user.sub, dto);
  }

  @NutritionistOnly()
  @Get('nutritional/patient/:patientId')
  findAllNutritional(@Request() req: any, @Param('patientId') patientId: string) {
    return this.svc.findAllNutritional(req.user.workspaceId, patientId);
  }

  @NutritionistOnly()
  @Get('nutritional/:id')
  findOneNutritional(@Request() req: any, @Param('id') id: string) {
    return this.svc.findOneNutritional(req.user.workspaceId, id, req.user.sub);
  }

  @NutritionistOnly()
  @Patch('nutritional/:id')
  updateNutritional(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<NutritionalAssessment>,
  ) {
    return this.svc.updateNutritional(req.user.workspaceId, id, req.user.sub, dto);
  }

  @NutritionistOnly()
  @Patch('nutritional/:id/finalize')
  finalizeNutritional(@Request() req: any, @Param('id') id: string) {
    return this.svc.finalizeNutritional(req.user.workspaceId, id, req.user.sub);
  }

  @NutritionistOnly()
  @RequiresTokens('nutritional_assessment_summary')
  @Post('nutritional/:id/ai-summary')
  generateAiSummary(@Request() req: any, @Param('id') id: string) {
    return this.svc.generateAiSummary(req.user.workspaceId, id, req.user.sub);
  }

  // ── Physical ─────────────────────────────────────────────────────────────

  @FitnessProfessionalOnly()
  @Post('physical')
  createPhysical(
    @Request() req: any,
    @Body() dto: Partial<PhysicalAssessment>,
  ) {
    return this.svc.createPhysical(req.user.workspaceId, req.user.sub, dto);
  }

  @FitnessProfessionalOnly()
  @Get('physical/patient/:patientId')
  findAllPhysical(@Request() req: any, @Param('patientId') patientId: string) {
    return this.svc.findAllPhysical(req.user.workspaceId, patientId);
  }

  @FitnessProfessionalOnly()
  @Get('physical/:id')
  findOnePhysical(@Request() req: any, @Param('id') id: string) {
    return this.svc.findOnePhysical(req.user.workspaceId, id, req.user.sub);
  }

  @FitnessProfessionalOnly()
  @Patch('physical/:id')
  updatePhysical(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<PhysicalAssessment>,
  ) {
    return this.svc.updatePhysical(req.user.workspaceId, id, req.user.sub, dto);
  }

  @FitnessProfessionalOnly()
  @Patch('physical/:id/finalize')
  finalizePhysical(@Request() req: any, @Param('id') id: string) {
    return this.svc.finalizePhysical(req.user.workspaceId, id, req.user.sub);
  }
}
