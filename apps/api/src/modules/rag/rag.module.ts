import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { TokensModule } from '../tokens/tokens.module';
import { RagService } from './rag.service';
import { RagSyncService } from './rag-sync.service';
import { RagController } from './rag.controller';

@Module({
  imports: [AiModule, TokensModule],
  providers: [RagService, RagSyncService],
  controllers: [RagController],
  exports: [RagService],
})
export class RagModule {}
