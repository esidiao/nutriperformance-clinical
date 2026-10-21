import {
  Controller, Get, Post, Delete, Param, Body, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DietaryRecallService } from './dietary-recall.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NutritionistOnly } from '../../common/decorators';

/**
 * Recordatório de 24h.
 *
 * `NutritionistOnly` e não `ClinicalStaff`: avaliar consumo alimentar é
 * atribuição do nutricionista. O mesmo critério do plano alimentar — e pelo
 * mesmo motivo, que é competência profissional, não preferência de produto.
 */
@ApiTags('dietary-recall')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recordatorios')
export class DietaryRecallController {
  constructor(private readonly svc: DietaryRecallService) {}

  @NutritionistOnly()
  @Post()
  @ApiOperation({ summary: 'Criar recordatório de 24h' })
  criar(@Request() req: any, @Body() dto: any) {
    return this.svc.criar(req.user.workspaceId, req.user.sub, dto);
  }

  /**
   * Antes de `@Get(':id')`: o Nest casa na ordem de declaração, e uma rota de
   * id engoliria este caminho.
   */
  @NutritionistOnly()
  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Recordatórios do paciente' })
  listar(@Request() req: any, @Param('patientId') patientId: string) {
    return this.svc.listarPorPaciente(req.user.workspaceId, patientId);
  }

  @NutritionistOnly()
  @Get(':id')
  @ApiOperation({ summary: 'Recordatório com itens e totais' })
  buscar(@Request() req: any, @Param('id') id: string) {
    return this.svc.buscar(req.user.workspaceId, id);
  }

  @NutritionistOnly()
  @Post(':id/items')
  @ApiOperation({ summary: 'Adicionar alimento relatado' })
  adicionarItem(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.adicionarItem(req.user.workspaceId, req.user.sub, id, dto);
  }

  @NutritionistOnly()
  @Delete(':id/items/:itemId')
  removerItem(
    @Request() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.svc.removerItem(req.user.workspaceId, req.user.sub, id, itemId);
  }

  @NutritionistOnly()
  @Delete(':id')
  remover(@Request() req: any, @Param('id') id: string) {
    return this.svc.remover(req.user.workspaceId, req.user.sub, id);
  }
}
