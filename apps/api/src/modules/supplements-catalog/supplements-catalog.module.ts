import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplementCatalog } from './supplement-catalog.entity';
import { SupplementsCatalogService } from './supplements-catalog.service';
import { SupplementsCatalogController } from './supplements-catalog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SupplementCatalog])],
  providers: [SupplementsCatalogService],
  controllers: [SupplementsCatalogController],
  exports: [SupplementsCatalogService],
})
export class SupplementsCatalogModule {}
