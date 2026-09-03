import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';
import { clampInt, clampOffset } from '../../common/pagination.util';
import { TokenTransaction } from './token-transaction.entity';
import { TokenCost } from './token-cost.entity';

export type TokenOperation =
  | 'purchase'
  | 'consumption'
  | 'refund'
  | 'bonus'
  | 'expiration'
  | 'admin_adjustment';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    @InjectRepository(Workspace) private workspaceRepo: Repository<Workspace>,
    @InjectRepository(TokenTransaction) private txRepo: Repository<TokenTransaction>,
    @InjectRepository(TokenCost) private costRepo: Repository<TokenCost>,
    private dataSource: DataSource,
  ) {}

  async getBalance(workspaceId: string): Promise<{ balance: number; reserved: number; available: number }> {
    const workspace = await this.workspaceRepo.findOneOrFail({ where: { id: workspaceId } });
    return {
      balance: workspace.tokenBalance,
      reserved: workspace.tokenReserved,
      available: workspace.tokenBalance - workspace.tokenReserved,
    };
  }

  /**
   * Tabela pública de preços, na ordem em que aparece para o usuário.
   *
   * Mesma fonte que `getCostFor` e que o TokenBalanceGuard consultam: se a
   * lista mostrar um preço, é esse que será cobrado.
   */
  async listarCustos() {
    const linhas = await this.costRepo.find({ order: { operation: 'ASC' } });
    return linhas.map((l) => ({
      operation: l.operation,
      tokens: l.tokensCost,
      description: l.description,
    }));
  }

  async getCostFor(operation: string): Promise<number> {
    const cost = await this.costRepo.findOne({ where: { operation } });
    if (!cost) throw new BadRequestException(`Operação desconhecida: ${operation}`);
    return cost.tokensCost;
  }

  /**
   * Verifica saldo e consome tokens atomicamente.
   * Lança exceção se saldo insuficiente.
   *
   * Devolve quanto foi cobrado. Antes não devolvia nada, e cada chamador
   * mantinha uma constante `COST` própria para gravar em `tokensConsumed` e
   * responder à tela. Duas fontes para o mesmo número: mudar o preço pelo
   * painel alterava a cobrança e deixava o registro do paciente mentindo.
   */
  async consume(params: {
    workspaceId: string;
    userId: string;
    operation: string;
    /**
     * Só para casos sem linha em `token_costs`. Passar isto faz o preço do
     * painel de admin ser ignorado — e, pior, faz o TokenBalanceGuard não
     * encontrar a operação e liberar a chamada paga sem conferir saldo.
     */
    cost?: number;
    resourceId?: string;
    referenceId?: string;
    description?: string;
  }): Promise<number> {
    const cost = params.cost ?? await this.getCostFor(params.operation);

    await this.dataSource.transaction(async (em) => {
      const workspace = await em
        .getRepository(Workspace)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: params.workspaceId })
        .getOneOrFail();

      const available = workspace.tokenBalance - workspace.tokenReserved;
      if (available < cost) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponível: ${available} tokens. Necessário: ${cost} tokens.`,
        );
      }

      workspace.tokenBalance -= cost;
      await em.save(workspace);

      const tx = em.getRepository(TokenTransaction).create({
        workspaceId: params.workspaceId,
        userId: params.userId,
        operation: 'consumption',
        amount: -cost,
        balanceAfter: workspace.tokenBalance,
        description: params.description ?? params.operation,
        module: params.operation,
        referenceId: params.referenceId ?? params.resourceId,
      });

      await em.save(tx);
    });

    return cost;
  }

  async credit(params: {
    workspaceId: string;
    userId?: string;
    operation: TokenOperation;
    amount: number;
    description: string;
    paymentId?: string;
  }): Promise<TokenTransaction> {
    if (params.paymentId) {
      const existing = await this.txRepo.findOne({ where: { paymentId: params.paymentId } });
      if (existing) {
        this.logger.warn(`Crédito ignorado — paymentId ${params.paymentId} já processado (tx ${existing.id})`);
        return existing;
      }
    }

    return this.dataSource.transaction(async (em) => {
      const workspace = await em
        .getRepository(Workspace)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: params.workspaceId })
        .getOneOrFail();

      workspace.tokenBalance += params.amount;
      await em.save(workspace);

      const tx = em.getRepository(TokenTransaction).create({
        workspaceId: params.workspaceId,
        userId: params.userId,
        operation: params.operation,
        amount: params.amount,
        balanceAfter: workspace.tokenBalance,
        description: params.description,
        paymentId: params.paymentId,
      });

      return em.save(tx);
    });
  }

  async getHistory(workspaceId: string, limit = 50, offset = 0) {
    return this.txRepo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
      // Sem teto, `?limit=999999` devolvia o histórico inteiro do workspace
      // numa requisição; `?limit=abc` virava `take: NaN` (erro do Postgres).
      take: clampInt(limit, 50, 200),
      skip: clampOffset(offset),
    });
  }

  async adminAdjust(params: {
    workspaceId: string;
    amount: number;
    reason: string;
    adminUserId: string;
  }): Promise<TokenTransaction> {
    return this.credit({
      workspaceId: params.workspaceId,
      userId: params.adminUserId,
      operation: 'admin_adjustment',
      amount: params.amount,
      description: params.reason,
    });
  }

}
