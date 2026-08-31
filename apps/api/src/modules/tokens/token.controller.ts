import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminOnly } from '../../common/decorators';
import { TokenService } from './token.service';

@ApiTags('tokens')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tokens')
export class TokenController {
  constructor(private tokenService: TokenService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Consultar saldo de tokens do workspace' })
  async getBalance(@Req() req: any) {
    return this.tokenService.getBalance(req.user.workspaceId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Histórico de transações de tokens' })
  async getHistory(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // O serviço faz o clamp (teto de 200 e fallback para valor não numérico).
    return this.tokenService.getHistory(req.user.workspaceId, Number(limit), Number(offset));
  }

  // Único caminho de crédito de tokens desde a remoção do checkout. Sem esta
  // rota o saldo só desce: qualquer operação de IA fica bloqueada para sempre
  // assim que o saldo inicial acaba.
  @Post('admin/adjust')
  @UseGuards(RolesGuard)
  @AdminOnly()
  @ApiOperation({ summary: 'Creditar ou debitar tokens de um workspace (admin)' })
  async adminAdjust(
    @Req() req: any,
    @Body() body: { workspaceId?: string; amount?: number; reason?: string },
  ) {
    const amount = Number(body?.amount);
    if (!body?.workspaceId || !Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException('Informe workspaceId e um amount diferente de zero');
    }
    if (!body?.reason?.trim()) {
      throw new BadRequestException('Informe o motivo do ajuste');
    }
    return this.tokenService.adminAdjust({
      workspaceId: body.workspaceId,
      amount,
      reason: body.reason.trim(),
      adminUserId: req.user.userId ?? req.user.id,
    });
  }

  @Get('costs')
  @ApiOperation({ summary: 'Tabela de custos por operação' })
  async getCosts(@Req() req: any) {
    // Retornar tabela pública de custos (sem autenticação especial)
    return {
      costs: [
        { operation: 'nutritional_assessment_ai', tokens: 10, description: 'Avaliação nutricional com IA' },
        { operation: 'physical_assessment_ai', tokens: 5, description: 'Avaliação física com IA' },
        { operation: 'interaction_analysis', tokens: 15, description: 'Análise de interações' },
        { operation: 'bioavailability_analysis', tokens: 12, description: 'Análise de biodisponibilidade' },
        { operation: 'supplementation_analysis', tokens: 8, description: 'Análise de suplementação' },
        { operation: 'report_generation', tokens: 5, description: 'Geração de relatório PDF' },
        { operation: 'lab_analysis', tokens: 10, description: 'Análise de exames' },
        { operation: 'goal_ai_suggestion', tokens: 5, description: 'Sugestão de meta com IA' },
      ],
    };
  }
}
