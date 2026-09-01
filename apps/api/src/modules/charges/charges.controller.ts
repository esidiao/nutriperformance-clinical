import {
  Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ChargesService } from './charges.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ClinicalStaff } from '../../common/decorators';

/**
 * Controle financeiro — o que foi cobrado e o que entrou.
 *
 * ClinicalStaff e não NutritionistOnly, mas repare no que ClinicalStaff deixa
 * de fora: `supervised_student`. Estagiário atende paciente e não vê o
 * faturamento da clínica — a diferença é intencional, não descuido.
 *
 * Não há rota de exclusão. Lançamento financeiro se cancela com motivo; apagar
 * destruiria a trilha do faturamento, que é justamente o registro que alguém
 * quereria sumir.
 */
@ApiTags('charges')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('charges')
export class ChargesController {
  constructor(private readonly svc: ChargesService) {}

  @ClinicalStaff()
  @Post()
  @ApiOperation({ summary: 'Registrar cobrança' })
  create(@Request() req: any, @Body() dto: any) {
    return this.svc.create(req.user.workspaceId, req.user.sub, dto);
  }

  @ClinicalStaff()
  @Get()
  @ApiOperation({ summary: 'Listar lançamentos' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'profissionalId', required: false })
  @ApiQuery({ name: 'de', required: false, description: 'Vencimento inicial (AAAA-MM-DD)' })
  @ApiQuery({ name: 'ate', required: false, description: 'Vencimento final (AAAA-MM-DD)' })
  listar(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('profissionalId') profissionalId?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.svc.listar(req.user.workspaceId, { status, patientId, profissionalId, de, ate });
  }

  // Antes de :id — senão o Nest casa "resumo" como um id e devolve 404.
  @ClinicalStaff()
  @Get('resumo')
  @ApiOperation({ summary: 'Resumo do caixa: a receber, vencido, recebido no mês' })
  @ApiQuery({ name: 'mes', required: false, description: 'AAAA-MM (padrão: mês corrente)' })
  @ApiQuery({ name: 'profissionalId', required: false })
  resumo(
    @Request() req: any,
    @Query('mes') mes?: string,
    @Query('profissionalId') profissionalId?: string,
  ) {
    return this.svc.resumo(req.user.workspaceId, { mes, profissionalId });
  }

  @ClinicalStaff()
  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do lançamento' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.svc.findOne(req.user.workspaceId, id);
  }

  @ClinicalStaff()
  @Patch(':id')
  @ApiOperation({ summary: 'Editar lançamento pendente' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.update(req.user.workspaceId, req.user.sub, id, dto);
  }

  @ClinicalStaff()
  @Patch(':id/pagar')
  @ApiOperation({ summary: 'Registrar recebimento' })
  pagar(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.pagar(req.user.workspaceId, req.user.sub, id, dto);
  }

  @ClinicalStaff()
  @Patch(':id/isentar')
  @ApiOperation({ summary: 'Isentar (atendimento gratuito — não conta como receita)' })
  isentar(@Request() req: any, @Param('id') id: string, @Body() body: { motivo?: string }) {
    return this.svc.isentar(req.user.workspaceId, req.user.sub, id, body?.motivo);
  }

  @ClinicalStaff()
  @Patch(':id/cancelar')
  @ApiOperation({ summary: 'Cancelar lançamento (exige motivo)' })
  cancelar(@Request() req: any, @Param('id') id: string, @Body() body: { motivo?: string }) {
    return this.svc.cancelar(req.user.workspaceId, req.user.sub, id, body?.motivo);
  }
}
