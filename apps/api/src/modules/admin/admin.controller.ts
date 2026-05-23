import {
  Controller, Get, Patch, Post, Param, Body, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators';
import { ScientificBaseService } from '../scientific-base/scientific-base.service';
import { TokenService } from '../tokens/token.service';

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
    const [workspaces] = await this.db.query(`SELECT COUNT(*) FROM workspaces WHERE is_active = true`);
    const [users] = await this.db.query(`SELECT COUNT(*) FROM users WHERE is_active = true`);
    const [patients] = await this.db.query(`SELECT COUNT(*) FROM patients WHERE deleted_at IS NULL`);
    const [tokensThisMonth] = await this.db.query(`
      SELECT COALESCE(SUM(ABS(amount)), 0) AS total
      FROM token_transactions
      WHERE amount < 0
        AND created_at >= date_trunc('month', NOW())
    `);
    const [mrr] = await this.db.query(`
      SELECT COALESCE(SUM(monthly_price_brl), 0) AS mrr
      FROM workspaces
      WHERE is_active = true AND plan != 'free'
    `);

    const moduleUsage = await this.db.query(`
      SELECT operation, COUNT(*) AS uses, SUM(ABS(amount)) AS tokens_consumed
      FROM token_transactions
      WHERE amount < 0 AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY operation
      ORDER BY uses DESC
    `);

    return {
      activeWorkspaces: Number(workspaces.count),
      activeUsers: Number(users.count),
      totalPatients: Number(patients.count),
      tokensConsumedThisMonth: Number(tokensThisMonth.total),
      mrrBrl: Number(mrr.mrr),
      moduleUsage,
    };
  }

  @Get('workspaces')
  async listWorkspaces(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const offset = (Number(page) - 1) * Number(limit);
    return this.db.query(
      `SELECT id, name, plan, token_balance, token_reserved, is_active, created_at,
              (SELECT COUNT(*) FROM users u WHERE u.workspace_id = w.id) AS user_count,
              (SELECT COUNT(*) FROM patients p WHERE p.workspace_id = w.id AND p.deleted_at IS NULL) AS patient_count
       FROM workspaces w
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [Number(limit), offset],
    );
  }

  @Get('workspaces/:id')
  async getWorkspace(@Param('id') id: string) {
    const [ws] = await this.db.query(
      `SELECT * FROM workspaces WHERE id = $1`, [id],
    );
    return ws;
  }

  @Patch('workspaces/:id/tokens')
  async adjustTokens(
    @Param('id') workspaceId: string,
    @Request() req: any,
    @Body('amount') amount: number,
    @Body('reason') reason: string,
  ) {
    return this.tokenService.adminAdjust({ workspaceId, amount, reason, adminUserId: req.user.sub });
  }

  @Patch('workspaces/:id/suspend')
  async suspendWorkspace(@Param('id') id: string) {
    await this.db.query(`UPDATE workspaces SET is_active = false WHERE id = $1`, [id]);
    return { success: true };
  }

  @Patch('workspaces/:id/reactivate')
  async reactivateWorkspace(@Param('id') id: string) {
    await this.db.query(`UPDATE workspaces SET is_active = true WHERE id = $1`, [id]);
    return { success: true };
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('workspaceId') workspaceId?: string,
    @Query('userId') userId?: string,
    @Query('resource') resource?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
  ) {
    const limit = 100;
    const offset = (Number(page) - 1) * limit;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (workspaceId) { params.push(workspaceId); conditions.push(`workspace_id = $${params.length}`); }
    if (userId) { params.push(userId); conditions.push(`user_id = $${params.length}`); }
    if (resource) { params.push(resource); conditions.push(`resource = $${params.length}`); }
    if (from) { params.push(from); conditions.push(`created_at >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`created_at <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    return this.db.query(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
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
    @Body('tokensCost') tokensCost: number,
  ) {
    await this.db.query(
      `UPDATE token_costs SET tokens_cost = $1 WHERE operation = $2`,
      [tokensCost, operation],
    );
    return { success: true };
  }
}
