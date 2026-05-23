import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.tokenService.getHistory(req.user.workspaceId, +limit, +offset);
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
