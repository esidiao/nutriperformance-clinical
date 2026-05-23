import {
  Injectable, CanActivate, ExecutionContext, BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from '../../modules/workspaces/workspace.entity';
import { TokenCost } from '../../modules/tokens/token-cost.entity';

export const TOKEN_OPERATION_KEY = 'token_operation';

/**
 * Verifica saldo ANTES de executar operações que consomem tokens.
 * Deve ser usado junto com @RequiresTokens('nome_operacao').
 */
@Injectable()
export class TokenBalanceGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Workspace) private workspaceRepo: Repository<Workspace>,
    @InjectRepository(TokenCost) private costRepo: Repository<TokenCost>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const operation = this.reflector.getAllAndOverride<string>(TOKEN_OPERATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!operation) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.workspaceId) return true;

    const [workspace, cost] = await Promise.all([
      this.workspaceRepo.findOne({ where: { id: user.workspaceId } }),
      this.costRepo.findOne({ where: { operation } }),
    ]);

    if (!workspace || !cost) return true;

    const available = workspace.tokenBalance - workspace.tokenReserved;
    if (available < cost.tokensCost) {
      throw new BadRequestException(
        `Saldo insuficiente. Disponível: ${available} tokens. ` +
        `Esta operação requer ${cost.tokensCost} tokens. ` +
        `Acesse /tokens para recarregar seu saldo.`,
      );
    }

    return true;
  }
}
