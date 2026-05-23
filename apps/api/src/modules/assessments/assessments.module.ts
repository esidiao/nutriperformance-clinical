import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NutritionalAssessment } from './nutritional-assessment.entity';
import { PhysicalAssessment } from './physical-assessment.entity';
import { AssessmentsService } from './assessments.service';
import { AssessmentsController } from './assessments.controller';
import { AiModule } from '../ai/ai.module';
import { TokensModule } from '../tokens/tokens.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NutritionalAssessment, PhysicalAssessment]),
    AiModule,
    TokensModule,
    AuditModule,
  ],
  providers: [AssessmentsService],
  controllers: [AssessmentsController],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
