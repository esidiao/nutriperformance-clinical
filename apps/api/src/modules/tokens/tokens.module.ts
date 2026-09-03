import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenService } from './token.service';
import { TokenController } from './token.controller';
import { TokenTransaction } from './token-transaction.entity';
import { TokenCost } from './token-cost.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { PrecoConfiguradoService } from './preco-configurado.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TokenTransaction, TokenCost, Workspace]),
    // Para varrer os @RequiresTokens dos controllers no boot.
    DiscoveryModule,
  ],
  providers: [TokenService, PrecoConfiguradoService],
  controllers: [TokenController],
  exports: [TokenService],
})
export class TokensModule {}
