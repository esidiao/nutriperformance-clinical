import {
  Controller, Post, Get, Param, Body, Req, Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportService } from './report.service';
import { TokenService } from '../tokens/token.service';
import { ClinicalStaff, RequiresTokens } from '../../common/decorators';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportController {
  constructor(
    private reportService: ReportService,
    private tokenService: TokenService,
  ) {}

  @Post('generate')
  @ClinicalStaff()
  @RequiresTokens('report_generation')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Gerar relatório PDF — consome 5 tokens' })
  async generate(@Body() body: any, @Req() req: any, @Res() res: Response) {
    // Consumir tokens
    await this.tokenService.consume({
      workspaceId: req.user.workspaceId,
      userId: req.user.id,
      operation: 'report_generation',
      description: `Relatório ${body.type} — ${body.patient?.internalCode ?? ''}`,
    });

    const pdfBuffer = await this.reportService.generatePDF({
      type: body.type,
      patient: body.patient,
      professional: {
        fullName: req.user.fullName,
        councilType: req.user.councilType ?? '',
        councilNumber: req.user.councilNumber ?? '',
        councilState: req.user.councilState ?? '',
      },
      workspace: { name: req.user.workspaceName ?? 'Clínica' },
      date: new Date().toLocaleDateString('pt-BR'),
      nutritionalAssessment: body.nutritionalAssessment,
      physicalAssessment: body.physicalAssessment,
      supplementation: body.supplementation,
      interactions: body.interactions,
      bioavailability: body.bioavailability,
      goals: body.goals,
      professionalNotes: body.professionalNotes,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="nutriperformance-${Date.now()}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
