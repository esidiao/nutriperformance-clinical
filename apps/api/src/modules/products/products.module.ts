import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndustrializedProduct } from './product.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [TypeOrmModule.forFeature([IndustrializedProduct]), RagModule],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
