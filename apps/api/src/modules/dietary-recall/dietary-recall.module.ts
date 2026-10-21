import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DietaryRecall } from './dietary-recall.entity';
import { DietaryRecallItem } from './dietary-recall-item.entity';
import { Food } from '../foods/food.entity';
import { DietaryRecallService } from './dietary-recall.service';
import { DietaryRecallController } from './dietary-recall.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DietaryRecall, DietaryRecallItem, Food]),
    AuditModule,
  ],
  providers: [DietaryRecallService],
  controllers: [DietaryRecallController],
  exports: [DietaryRecallService],
})
export class DietaryRecallModule {}
