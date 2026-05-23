import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ScientificBaseModule } from '../scientific-base/scientific-base.module';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [ScientificBaseModule, TokensModule],
  controllers: [AdminController],
})
export class AdminModule {}
