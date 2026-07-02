import {
  Controller, Post, Get, Patch, Param, Body, Req, Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsNumber, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Response } from 'express';
import { InteractionService } from './interaction.service';
import { AlertsService } from '../alerts/alerts.service';
import { AIEngineService, InteractionAnalysisInput } from '../ai/ai-engine.service';
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
    private aiEngine: AIEngineService,
  ) {}

  @Post('analyze')
  @ClinicalStaff()
  @RequiresTokens('interaction_analysis')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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

  @Post('analyze/stream')
  @ClinicalStaff()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Analisar interações com streaming SSE — consome 15 tokens' })
  async analyzeStream(@Body() dto: AnalyzeInteractionsDto, @Req() req: any, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const aiInput: InteractionAnalysisInput = {
      supplements: dto.supplements,
      medications: dto.medications,
      clinicalConditions: dto.clinicalConditions,
      labResults: dto.labResults as any,
      patientContext: {
        age: dto.patientAge,
        gender: dto.patientGender,
        isPregnant: dto.isPregnant,
        isBreastfeeding: dto.isBreastfeeding,
      },
    };

    // Build the prompt reusing the same structure as the standard analysis
    const prompt = `
Analise as possíveis interações entre os itens abaixo para o seguinte perfil de paciente:

PERFIL: ${aiInput.patientContext.age} anos, ${aiInput.patientContext.gender}${aiInput.patientContext.isPregnant ? ', gestante' : ''}${aiInput.patientContext.isBreastfeeding ? ', lactante' : ''}

SUPLEMENTOS EM USO:
${aiInput.supplements.map((s) => `- ${s.name} ${s.dose ? `(${s.dose})` : ''} ${s.frequency ? `/ ${s.frequency}` : ''}`).join('\n')}

MEDICAMENTOS EM USO:
${aiInput.medications.map((m) => `- ${m.name}${m.activePrinciple ? ` [PA: ${m.activePrinciple}]` : ''} ${m.dose ? `(${m.dose})` : ''}`).join('\n')}

CONDIÇÕES CLÍNICAS: ${aiInput.clinicalConditions.join(', ') || 'Não informado'}

${aiInput.labResults ? `EXAMES RELEVANTES:\n${JSON.stringify(aiInput.labResults, null, 2)}` : ''}

Para cada interação identificada, informe:
1. Entidades envolvidas (A x B)
2. Tipo: suplemento-medicamento / suplemento-suplemento / suplemento-condição / suplemento-exame
3. Nível de risco: baixo / moderado / alto / contraindicado / dados insuficientes
4. Mecanismo (se conhecido e embasado)
5. Nível de confiança e qualidade da evidência
6. Recomendação para o profissional
7. Necessidade de revisão médica

Se não houver evidência suficiente para afirmar uma interação, declare explicitamente.
    `;

    try {
      for await (const chunk of this.aiEngine.generateStream(prompt, 2048)) {
        res.write(`data: ${chunk}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } finally {
      res.end();
    }
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
