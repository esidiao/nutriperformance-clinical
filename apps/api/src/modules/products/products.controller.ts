import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicalStaff } from '../../common/decorators';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('search')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Buscar produtos industrializados no cache local' })
  @ApiQuery({ name: 'q', required: true, type: String })
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.productsService.search(q, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('barcode/:ean')
  @ClinicalStaff()
  // Proxy para Open Food Facts — teto de taxa protege a API externa e o app.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Buscar produto por código de barras (cache local → Open Food Facts)' })
  byBarcode(@Param('ean') ean: string) {
    return this.productsService.findByBarcode(ean);
  }
}
