import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicalStaff } from '../../common/decorators';
import { SupplementsCatalogService } from './supplements-catalog.service';

@ApiTags('supplements-catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('supplements-catalog')
export class SupplementsCatalogController {
  constructor(private readonly svc: SupplementsCatalogService) {}

  @Get('search')
  @ClinicalStaff()
  // Proxy para NIH DSLD — teto de taxa protege a API externa.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Buscar suplementos no catálogo NIH DSLD (cache local)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.svc.search(q, limit ? parseInt(limit, 10) : undefined);
  }
}
