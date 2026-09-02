import {
  Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SupervisionService } from './supervision.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NutritionistOnly, ClinicalStaff } from '../../common/decorators';

@ApiTags('supervision')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('supervision')
export class SupervisionController {
  constructor(private readonly svc: SupervisionService) {}

  /**
   * Solicitar revisão. NutritionistOnly porque INCLUI o estagiário — é ele
   * quem pede.
   */
  @NutritionistOnly()
  @Post()
  @ApiOperation({ summary: 'Enviar trabalho para supervisão' })
  solicitar(@Request() req: any, @Body() dto: any) {
    return this.svc.solicitar(req.user.workspaceId, req.user.sub, dto);
  }

  @NutritionistOnly()
  @Get()
  @ApiOperation({ summary: 'Listar pedidos de supervisão' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'estudanteId', required: false })
  listar(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('estudanteId') estudanteId?: string,
  ) {
    return this.svc.listar(req.user.workspaceId, { status, estudanteId });
  }

  @NutritionistOnly()
  @Get('recurso/:recurso/:recursoId')
  @ApiOperation({ summary: 'Situação de supervisão de um trabalho' })
  doRecurso(
    @Request() req: any,
    @Param('recurso') recurso: string,
    @Param('recursoId') recursoId: string,
  ) {
    return this.svc.doRecurso(req.user.workspaceId, recurso, recursoId);
  }

  /**
   * Decidir. ClinicalStaff porque EXCLUI o estagiário — quem aprova assume
   * responsabilidade profissional pelo que foi prescrito, e o estagiário ainda
   * não pode assumi-la. O guard já barra; o serviço barra de novo a
   * autoaprovação, porque um profissional habilitado tambem nao supervisiona o
   * proprio trabalho.
   */
  @ClinicalStaff()
  @Patch(':id/decidir')
  @ApiOperation({ summary: 'Aprovar ou pedir ajustes' })
  decidir(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.decidir(req.user.workspaceId, req.user.sub, id, dto);
  }

  @ClinicalStaff()
  @Get('pendentes/contagem')
  @ApiOperation({ summary: 'Quantos pedidos aguardam decisão' })
  async pendentes(@Request() req: any) {
    return { pendentes: await this.svc.pendentes(req.user.workspaceId) };
  }
}
