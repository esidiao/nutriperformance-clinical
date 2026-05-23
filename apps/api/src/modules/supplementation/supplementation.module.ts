import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientSupplementation } from './patient-supplementation.entity';
import { SupplementationService } from './supplementation.service';
import { SupplementationController } from './supplementation.controller';
import { AiModule } from '../ai/ai.module';
import { TokensModule } from '../tokens/tokens.module';
import { AlertsModule } from '../alerts/alerts.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PatientSupplementation]),
    AiModule,
    TokensModule,
    AlertsModule,
    AuditModule,
  ],
  providers: [SupplementationService],
  controllers: [SupplementationController],
  exports: [SupplementationService],
})
export class SupplementationModule {}
