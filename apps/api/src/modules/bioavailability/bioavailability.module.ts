import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BioavailabilityAnalysis } from './bioavailability-analysis.entity';
import { BioavailabilityService } from './bioavailability.service';
import { BioavailabilityController } from './bioavailability.controller';
import { AiModule } from '../ai/ai.module';
import { TokensModule } from '../tokens/tokens.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BioavailabilityAnalysis]),
    AiModule,
    TokensModule,
    AuditModule,
  ],
  providers: [BioavailabilityService],
  controllers: [BioavailabilityController],
  exports: [BioavailabilityService],
})
export class BioavailabilityModule {}
