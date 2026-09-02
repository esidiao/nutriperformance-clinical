import {
  Controller, Get, Patch, Post, Param, Body, Query, Request, UseGuards,
  ParseUUIDPipe, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators';
import { ScientificBaseService } from '../scientific-base/scientific-base.service';
import { TokenService } from '../tokens/token.service';
import {
  ListWorkspacesQueryDto, AuditLogsQueryDto, AdjustTokensDto, UpdateTokenCostDto,
} from './dto/admin-query.dto';

// Colunas expostas do workspace — evita devolver `settings` (jsonb que pode
// guardar credenciais de integração) num SELECT *.
const WORKSPACE_COLUMNS = `id, name, slug, cnpj, logo_url, plan, token_balance,
  token_reserved, is_active, trial_ends_at, created_at, updated_at`;

const AUDIT_LOG_COLUMNS = `id, workspace_id, user_id, patient_id, action, resource,
  resource_id, ip_address, success, created_at`;

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AdminOnly()
@Controller('admin')
export class AdminController {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly scientificBase: ScientificBaseService,
    private readonly tokenService: TokenService,
  ) {}

  @Get('metrics')
  async getMetrics() {
    // Consultas independentes → paralelizadas (evita 6 round-trips sequenciais ao Postgres).
    const [
      [workspaces],
      [users],
      [patients],
      [tokensThisMonth],
      [mrr],
      moduleUsage,
    ] = await Promise.all([
      this.db.query(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE is_active = true) AS active
        FROM workspaces
      `),
      this.db.query(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE is_active = true) AS active
        FROM users
      `),
      // `deleted_at` NAO existe em patients — a coluna de exclusao logica e
      // `is_active`, e ha ainda `data_deletion_requested_at` para o pedido de
      // apagamento da LGPD. A consulta antiga derrubava /admin/metrics inteiro,
      // porque Promise.all falha na primeira query que quebra.
      this.db.query(`SELECT COUNT(*) FROM patients WHERE is_active = true`),
      this.db.query(`
        SELECT COALESCE(SUM(ABS(amount)), 0) AS total
        FROM token_transactions
        WHERE amount < 0
          AND created_at >= date_trunc('month', NOW())
      `),
      // MRR REMOVIDO. `monthly_price_brl` nao existe em workspaces, e nao
      // adianta criar: os meios de pagamento foram retirados da plataforma
      // enquanto a estrategia comercial nao e definida. Receita recorrente
      // calculada sobre preco que ninguem cobra seria numero inventado num
      // painel de gestao — pior que numero nenhum.
      Promise.resolve([{ mrr: null }]),
      this.db.query(`
        SELECT operation, COUNT(*) AS uses, SUM(ABS(amount)) AS tokens_consumed
        FROM token_transactions
        WHERE amount < 0 AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY operation
        ORDER BY uses DESC
      `),
    ]);

    return {
      totalWorkspaces: Number(workspaces.total),
      activeWorkspaces: Number(workspaces.active),
      totalUsers: Number(users.total),
      activeUsers: Number(users.active),
      totalPatients: Number(patients.count),
      tokensConsumedThisMonth: Number(tokensThisMonth.total),
      // null e nao 0: zero seria lido como "nenhuma receita", quando o correto
      // e "nao ha cobranca configurada". Number(null) daria 0 e apagaria a
      // diferenca.
      mrrBrl: mrr.mrr === null ? null : Number(mrr.mrr),
      moduleUsage,
    };
  }

  @Get('workspaces')
  async listWorkspaces(@Query() query: ListWorkspacesQueryDto) {
    const { page, limit } = query;
    const offset = (page - 1) * limit;
    const [items, [count]] = await Promise.all([
      this.db.query(
        `SELECT id, name, plan, token_balance, token_reserved, is_active, created_at,
                (SELECT COUNT(*) FROM users u WHERE u.workspace_id = w.id) AS user_count,
                (SELECT COUNT(*) FROM patients p WHERE p.workspace_id = w.id AND p.is_active = true) AS patient_count
         FROM workspaces w
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.db.query(`SELECT COUNT(*) AS total FROM workspaces`),
    ]);
    const total = Number(count.total);
    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  @Get('workspaces/:id')
  async getWorkspace(@Param('id', ParseUUIDPipe) id: string) {
    const [ws] = await this.db.query(
      `SELECT ${WORKSPACE_COLUMNS} FROM workspaces WHERE id = $1`, [id],
    );
    if (!ws) throw new NotFoundException('Workspace não encontrado');
    return ws;
  }

  @Patch('workspaces/:id/tokens')
  async adjustTokens(
    @Param('id', ParseUUIDPipe) workspaceId: string,
    @Request() req: any,
    @Body() dto: AdjustTokensDto,
  ) {
    return this.tokenService.adminAdjust({
      workspaceId,
      amount: dto.amount,
      reason: dto.reason,
      adminUserId: req.user.sub,
    });
  }

  @Patch('workspaces/:id/suspend')
  async suspendWorkspace(@Param('id', ParseUUIDPipe) id: string) {
    await this.db.query(`UPDATE workspaces SET is_active = false WHERE id = $1`, [id]);
    return { success: true };
  }

  @Patch('workspaces/:id/reactivate')
  async reactivateWorkspace(@Param('id', ParseUUIDPipe) id: string) {
    await this.db.query(`UPDATE workspaces SET is_active = true WHERE id = $1`, [id]);
    return { success: true };
  }

  @Get('audit-logs')
  async getAuditLogs(@Query() query: AuditLogsQueryDto) {
    const { page, limit, workspaceId, userId, resource, from, to } = query;
    const offset = (page - 1) * limit;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (workspaceId) { params.push(workspaceId); conditions.push(`l.workspace_id = $${params.length}`); }
    if (userId) { params.push(userId); conditions.push(`l.user_id = $${params.length}`); }
    if (resource) { params.push(resource); conditions.push(`l.resource = $${params.length}`); }
    if (from) { params.push(from); conditions.push(`l.created_at >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`l.created_at <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total e página em paralelo — a contagem não depende do LIMIT/OFFSET.
    const [items, [count]] = await Promise.all([
      this.db.query(
        `SELECT ${AUDIT_LOG_COLUMNS.split(',').map(c => `l.${c.trim()}`).join(', ')}, u.email AS user_email
         FROM audit_logs l
         -- audit_logs.user_id guarda o UID do Supabase (req.user.sub),
         -- que corresponde a users.auth_id — não a users.id.
         --
         -- O ::text não é enfeite: audit_logs.user_id é uuid e users.auth_id é
         -- text, então o "=" cru não existe no Postgres e a rota devolvia 500
         -- em TODA chamada. A conversão vai no lado uuid de propósito —
         -- auth_id::uuid quebraria em qualquer linha que não seja um UUID
         -- válido, e sendo text a coluna não garante que sejam.
         LEFT JOIN users u ON u.auth_id = l.user_id::text
         ${where}
         ORDER BY l.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.db.query(`SELECT COUNT(*) AS total FROM audit_logs l ${where}`, params),
    ]);

    const total = Number(count.total);
    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  @Get('scientific-base/health')
  getScientificHealth() {
    return this.scientificBase.getHealth();
  }

  @Post('scientific-base/:category/mark-updated')
  markScientificUpdated(@Param('category') category: string) {
    return this.scientificBase.markCategoryUpdated(category);
  }

  @Get('token-costs')
  async getTokenCosts() {
    return this.db.query(`SELECT operation, tokens_cost FROM token_costs ORDER BY operation`);
  }

  @Patch('token-costs/:operation')
  async updateTokenCost(
    @Param('operation') operation: string,
    @Body() dto: UpdateTokenCostDto,
  ) {
    const result = await this.db.query(
      `UPDATE token_costs SET tokens_cost = $1 WHERE operation = $2 RETURNING operation`,
      [dto.tokensCost, operation],
    );
    if (!result?.length) throw new NotFoundException(`Operação '${operation}' não encontrada`);
    return { success: true };
  }
}
