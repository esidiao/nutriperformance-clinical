import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MealPlansService } from './meal-plans.service';
import { MealPlan } from './meal-plan.entity';
import { MealPlanItem } from './meal-plan-item.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NutritionistOnly } from '../../common/decorators';

/**
 * Prescrever plano alimentar é ato privativo do nutricionista (CFN), por isso
 * NutritionistOnly e não ClinicalStaff — o educador físico não entra aqui.
 */
@ApiTags('meal-plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('meal-plans')
export class MealPlansController {
  constructor(private readonly svc: MealPlansService) {}

  @NutritionistOnly()
  @Post()
  @ApiOperation({ summary: 'Criar plano alimentar' })
  create(@Request() req: any, @Body() dto: Partial<MealPlan>) {
    return this.svc.create(req.user.workspaceId, req.user.sub, dto);
  }

  @NutritionistOnly()
  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Planos alimentares de um paciente' })
  findByPatient(@Request() req: any, @Param('patientId') patientId: string) {
    return this.svc.findByPatient(req.user.workspaceId, patientId);
  }

  // ANTES de @Get(':id'): sem isso o Nest casa "modelos" como um id de plano
  // e devolve 404.
  @NutritionistOnly()
  @Get('modelos')
  @ApiOperation({ summary: 'Modelos de plano do workspace' })
  listarModelos(@Request() req: any) {
    return this.svc.listarModelos(req.user.workspaceId);
  }

  @NutritionistOnly()
  @Post(':id/salvar-como-modelo')
  @ApiOperation({ summary: 'Salvar plano como modelo reutilizável' })
  salvarComoModelo(@Request() req: any, @Param('id') id: string, @Body() body: { nome?: string }) {
    return this.svc.salvarComoModelo(req.user.workspaceId, req.user.sub, id, body?.nome);
  }

  @NutritionistOnly()
  @Post('modelos/:id/aplicar')
  @ApiOperation({ summary: 'Gerar plano para um paciente a partir do modelo' })
  aplicarModelo(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.aplicarModelo(req.user.workspaceId, req.user.sub, id, dto);
  }

  @NutritionistOnly()
  @Get(':id/lista-compras')
  @ApiOperation({ summary: 'Lista de compras derivada do plano' })
  @ApiQuery({
    name: 'dias', required: false,
    description: 'Dias a comprar. Padrão: intervalo do plano, ou 7.',
  })
  listaCompras(@Request() req: any, @Param('id') id: string, @Query('dias') dias?: string) {
    return this.svc.listaCompras(req.user.workspaceId, id, dias ? Number(dias) : undefined);
  }

  @NutritionistOnly()
  @Get(':id')
  @ApiOperation({ summary: 'Plano com refeições e totais nutricionais' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.svc.findOne(req.user.workspaceId, id);
  }

  @NutritionistOnly()
  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar plano alimentar' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: Partial<MealPlan>) {
    return this.svc.update(req.user.workspaceId, req.user.sub, id, dto);
  }

  @NutritionistOnly()
  @Delete(':id')
  @ApiOperation({ summary: 'Desativar plano alimentar (remoção lógica)' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.workspaceId, req.user.sub, id);
  }

  @NutritionistOnly()
  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicar plano com todos os itens' })
  duplicate(@Request() req: any, @Param('id') id: string, @Body() body: { nome?: string }) {
    return this.svc.duplicate(req.user.workspaceId, req.user.sub, id, body?.nome);
  }

  @NutritionistOnly()
  @Post(':id/items')
  @ApiOperation({ summary: 'Adicionar alimento a uma refeição' })
  addItem(@Request() req: any, @Param('id') id: string, @Body() dto: Partial<MealPlanItem>) {
    return this.svc.addItem(req.user.workspaceId, req.user.sub, id, dto);
  }

  @NutritionistOnly()
  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remover alimento do plano' })
  removeItem(
    @Request() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.svc.removeItem(req.user.workspaceId, req.user.sub, id, itemId);
  }
}
