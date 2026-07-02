import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Food } from './food.entity';
import { FoodsService } from './foods.service';
import { FoodsController } from './foods.controller';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [TypeOrmModule.forFeature([Food]), RagModule],
  providers: [FoodsService],
  controllers: [FoodsController],
  exports: [FoodsService],
})
export class FoodsModule {}
