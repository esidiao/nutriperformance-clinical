import { Module } from '@nestjs/common';
import { ScientificBaseService } from './scientific-base.service';
import { ScientificBaseController } from './scientific-base.controller';

@Module({
  providers: [ScientificBaseService],
  controllers: [ScientificBaseController],
  exports: [ScientificBaseService],
})
export class ScientificBaseModule {}
