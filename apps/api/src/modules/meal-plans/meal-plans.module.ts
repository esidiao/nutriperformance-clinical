import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealPlan } from './meal-plan.entity';
import { MealPlanItem } from './meal-plan-item.entity';
import { Food } from '../foods/food.entity';
import { MealPlansService } from './meal-plans.service';
import { MealPlansController } from './meal-plans.controller';
import { AuditModule } from '../audit/audit.module';
import { SupervisionModule } from '../supervision/supervision.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MealPlan, MealPlanItem, Food]),
    AuditModule,
    SupervisionModule,
  ],
  providers: [MealPlansService],
  controllers: [MealPlansController],
  exports: [MealPlansService],
})
export class MealPlansModule {}
