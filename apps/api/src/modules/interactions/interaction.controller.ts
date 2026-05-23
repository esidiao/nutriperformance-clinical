import {
  Controller, Post, Get, Patch, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsNumber, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InteractionService } from './interaction.service';
import { AlertsService } from '../alerts/alerts.service';
import { ClinicalStaff, RequiresTokens } from '../../common/decorators';

class SupplementItemDto {
  @IsString() name: string;
  @IsOptional() @IsString() dose?: string;
  @IsOptional() @IsString() frequency?: string;
}

class MedicationItemDto {
  @IsString() name: string;
  @IsOptional() @IsString() activePrinciple?: string;
  @IsOptional() @IsString() dose?: string;
}

class AnalyzeInteractionsDto {
  @IsString() patientId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SupplementItemDto)
  supplements: SupplementItemDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MedicationItemDto)
  medications: MedicationItemDto[];
  @IsArray() @IsString({ each: true }) clinicalConditions: string[];
  @IsOptional() labResults?: Record<string, unknown>;
  @IsNumber() patientAge: number;
  @IsString() patientGender: string;
  @IsOptional() @IsBoolean() isPregnant?: boolean;
  @IsOptional() @IsBoolean() isBreastfeeding?: boolean;
}

@ApiTags('interactions')
@ApiBearerAuth()
@Controller('interactions')
export class InteractionController {
  constructor(
    private interactionService: InteractionService,
    private alertsService: AlertsService,
  ) {}

  @Post('analyze')
  @ClinicalStaff()
  @RequiresTokens('interaction_analysis')
  @ApiOperation({ summary: 'Analisar interações — consome 15 tokens' })
  async analyze(@Body() dto: AnalyzeInteractionsDto, @Req() req: any) {
    const result = await this.interactionService.analyze({
      ...dto,
      labResults: dto.labResults as any,
      workspaceId: req.user.workspaceId,
      userId: req.user.id,
    });

    // Disparar avaliação de alertas clínicos em paralelo
    this.alertsService.evaluateAndCreateAlerts({
      patientId: dto.patientId,
      workspaceId: req.user.workspaceId,
      context: {
        supplements: dto.supplements,
        medications: dto.medications,
        clinicalConditions: dto.clinicalConditions,
        patientAge: dto.patientAge,
        isPregnant: dto.isPregnant,
      },
    }).catch(() => {/* silencioso — não bloquear resposta */});

    return result;
  }

  @Get(':patientId')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Histórico de análises de interações do paciente' })
  async getHistory(@Param('patientId') patientId: string) {
    // Retornado pelo repositório via service — simplificado aqui
    return { patientId, analyses: [] };
  }

  @Patch(':id/review')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Registrar revisão profissional da análise' })
  async addProfessionalReview(
    @Param('id') id: string,
    @Body() body: { review: string },
    @Req() req: any,
  ) {
    return { id, review: body.review, reviewedBy: req.user.id, reviewedAt: new Date() };
  }
}
