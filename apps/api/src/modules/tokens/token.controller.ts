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
  async getCosts() {
    // Lê `token_costs`. Era um array fixo aqui, e por isso a lista pública não
    // tinha relação nenhuma com o que a plataforma de fato cobra: anunciava
    // `lab_analysis` (nome antigo), omitia as cinco operações realmente
    // tarifadas e listava quatro que nenhum código executa. O painel de admin
    // edita esta tabela — editar sem que a lista mudasse era o efeito visível.
    return { costs: await this.tokenService.listarCustos() };
  }
}
