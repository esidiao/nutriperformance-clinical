import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicalStaff } from '../../common/decorators';
import { FoodsService } from './foods.service';

@ApiTags('foods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Get('search')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Buscar alimentos na base de composição (TACO/TBCA/USDA)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.foodsService.search(q, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('usda')
  @ClinicalStaff()
  // Proxy ao USDA FoodData Central — teto de taxa (DEMO_KEY é limitada).
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Buscar/importar alimentos do USDA FoodData Central (cacheia em foods)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  searchUsda(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.foodsService.searchUsda(q, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('compare')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Comparar 2 a 4 alimentos lado a lado' })
  @ApiQuery({ name: 'ids', required: true, type: String, description: 'IDs separados por vírgula' })
  compare(@Query('ids') ids: string) {
    return this.foodsService.compare((ids ?? '').split(',').map((s) => s.trim()));
  }

  @Get(':id')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Detalhe de um alimento, com proveniência' })
  findOne(@Param('id') id: string) {
    return this.foodsService.findById(id);
  }
}
