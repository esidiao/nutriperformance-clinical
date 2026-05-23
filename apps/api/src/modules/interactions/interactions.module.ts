import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InteractionAnalysis } from './interaction-analysis.entity';
import { InteractionService } from './interaction.service';
import { InteractionController } from './interaction.controller';
import { AiModule } from '../ai/ai.module';
import { TokensModule } from '../tokens/tokens.module';
import { AlertsModule } from '../alerts/alerts.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InteractionAnalysis]),
    AiModule,
    TokensModule,
    AlertsModule,
    AuditModule,
  ],
  providers: [InteractionService],
  controllers: [InteractionController],
  exports: [InteractionService],
})
export class InteractionsModule {}
