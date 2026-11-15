import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicalStaff } from '../../common/decorators';
import { ManagementService } from './management.service';

/**
 * Indicadores de gestão do workspace.
 *
 * `ClinicalStaff` e não `NutritionistOnly`: o painel é da clínica, e quem
 * administra pode não atender. Mas `supervised_student` fica FORA — está em
 * `NutritionistOnly` e não aqui, porque este painel mostra receita e
 * inadimplência da clínica, que não é assunto de quem está em supervisão.
 *
 * O escopo é sempre `req.user.workspaceId`, nunca parâmetro: workspace vindo da
 * URL seria o caminho mais curto para um gestor ler a clínica do vizinho.
 */
@ApiTags('management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('management')
export class ManagementController {
  constructor(private readonly management: ManagementService) {}

  @Get('indicators')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Indicadores de gestão da clínica no período' })
  @ApiQuery({ name: 'dias', required: false, description: 'Janela em dias (7 a 365, padrão 90)' })
  @ApiQuery({
    name: 'diasAbandono',
    required: false,
    description: 'Dias sem consulta para considerar abandono (7 a 365, padrão 90)',
  })
  async indicators(
    @Req() req: any,
    @Query('dias') dias?: string,
    @Query('diasAbandono') diasAbandono?: string,
  ) {
    // `parseInt` de texto vazio dá NaN, e o serviço trata NaN como "use o
    // padrão". Não validamos aqui para não duplicar a regra em dois lugares —
    // o limite de 7 a 365 vive no serviço, que é quem usa o número.
    return this.management.indicadores(req.user.workspaceId, {
      dias: dias !== undefined ? parseInt(dias, 10) : undefined,
      diasAbandono: diasAbandono !== undefined ? parseInt(diasAbandono, 10) : undefined,
    });
  }
}
