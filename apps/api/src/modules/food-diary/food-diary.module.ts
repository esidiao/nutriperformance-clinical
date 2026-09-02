import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodDiaryLink, FoodDiaryEntry } from './food-diary.entities';
import { FoodDiaryService } from './food-diary.service';
import {
  FoodDiaryController, FoodDiaryPublicoController, FoodDiaryRetencaoController,
} from './food-diary.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([FoodDiaryLink, FoodDiaryEntry]), AuditModule],
  providers: [FoodDiaryService],
  controllers: [FoodDiaryController, FoodDiaryPublicoController, FoodDiaryRetencaoController],
  exports: [FoodDiaryService],
})
export class FoodDiaryModule {}
