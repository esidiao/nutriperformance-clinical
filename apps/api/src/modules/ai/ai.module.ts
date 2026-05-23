import { Module } from '@nestjs/common';
import { AIEngineService as AiEngineService } from './ai-engine.service';

@Module({
  providers: [AiEngineService],
  exports: [AiEngineService],
})
export class AiModule {}
