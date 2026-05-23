import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaboratoryExam } from './laboratory-exam.entity';
import { LaboratoryService } from './laboratory.service';
import { LaboratoryController } from './laboratory.controller';
import { AiModule } from '../ai/ai.module';
import { TokensModule } from '../tokens/tokens.module';
import { AlertsModule } from '../alerts/alerts.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LaboratoryExam]),
    AiModule,
    TokensModule,
    AlertsModule,
    AuditModule,
  ],
  providers: [LaboratoryService],
  controllers: [LaboratoryController],
  exports: [LaboratoryService],
})
export class LaboratoryModule {}
