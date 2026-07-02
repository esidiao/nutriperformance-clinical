import { Controller, Get, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators';
import { CurationService } from './curation.service';

class UpdateFoodCurationDto {
  @IsOptional() @IsIn(['alta', 'media', 'baixa', 'pendente']) confiabilidade?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

@ApiTags('curation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('curation')
export class CurationController {
  constructor(private readonly svc: CurationService) {}

  @Get('overview')
  @AdminOnly()
  @ApiOperation({ summary: 'Governança das bases: contagens, fontes e importações' })
  overview() {
    return this.svc.overview();
  }

  @Get('foods')
  @AdminOnly()
  @ApiOperation({ summary: 'Listar alimentos para curadoria' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  listFoods(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
  ) {
    return this.svc.listFoods({ status, q: q || undefined, page: page ? parseInt(page, 10) : undefined });
  }

  @Patch('foods/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Curadoria: ajustar confiabilidade/ativo de um alimento' })
  updateFood(@Param('id') id: string, @Body() dto: UpdateFoodCurationDto, @Req() req: any) {
    return this.svc.updateFood(id, dto, req.user.id, req.ip);
  }
}
