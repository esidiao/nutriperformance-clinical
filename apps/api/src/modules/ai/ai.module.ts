import { Module } from '@nestjs/common';
import { AIEngineService as AiEngineService } from './ai-engine.service';
import { AIStreamController } from './ai-stream.controller';

@Module({
  controllers: [AIStreamController],
  providers: [AiEngineService],
  exports: [AiEngineService],
})
export class AiModule {}
