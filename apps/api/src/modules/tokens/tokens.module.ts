import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenService } from './token.service';
import { TokenController } from './token.controller';
import { TokenTransaction } from './token-transaction.entity';
import { TokenCost } from './token-cost.entity';
import { Workspace } from '../workspaces/workspace.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TokenTransaction, TokenCost, Workspace])],
  providers: [TokenService],
  controllers: [TokenController],
  exports: [TokenService],
})
export class TokensModule {}
