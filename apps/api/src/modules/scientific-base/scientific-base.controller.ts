import {
  Controller, Get, Patch, Query, Param, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScientificBaseService } from './scientific-base.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminOnly, ClinicalStaff } from '../../common/decorators';

@ApiTags('scientific-base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('scientific-base')
export class ScientificBaseController {
  constructor(private readonly svc: ScientificBaseService) {}

  @ClinicalStaff()
  @Get('health')
  getHealth() {
    return this.svc.getHealth();
  }

  @ClinicalStaff()
  @Get('stale')
  getStale() {
    return this.svc.getStaleCategories();
  }

  @ClinicalStaff()
  @Get('search')
  search(
    @Query('q') query: string,
    @Query('category') category?: string,
  ) {
    return this.svc.searchReferences(query, category);
  }

  @ClinicalStaff()
  @Get('category/:category')
  listByCategory(
    @Param('category') category: string,
    @Query('limit') limit = '200',
    @Query('offset') offset = '0',
  ) {
    return this.svc.listByCategory(category, Number(limit), Number(offset));
  }

  @AdminOnly()
  @Patch('category/:category/mark-updated')
  markUpdated(@Param('category') category: string) {
    return this.svc.markCategoryUpdated(category);
  }
}
