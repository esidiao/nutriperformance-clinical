import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AdminController } from './admin.controller';
import {
  ListWorkspacesQueryDto, AuditLogsQueryDto, AdjustTokensDto, UpdateTokenCostDto,
} from './dto/admin-query.dto';

/** Simula o ValidationPipe global (transform + whitelist). */
async function validateQuery<T extends object>(cls: new () => T, raw: Record<string, unknown>) {
  const dto = plainToInstance(cls, raw, { enableImplicitConversion: true });
  const errors = await validate(dto as object, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors };
}

describe('AdminController', () => {
  let controller: AdminController;
  let db: any;
  let scientificBase: any;
  let tokenService: any;

  beforeEach(() => {
    db = { query: jest.fn().mockResolvedValue([]) };
    scientificBase = { getHealth: jest.fn(), markCategoryUpdated: jest.fn() };
    tokenService = { adminAdjust: jest.fn().mockResolvedValue({ balance: 10 }) };
    controller = new AdminController(db, scientificBase, tokenService);
  });

  describe('paginação validada', () => {
    it('aplica defaults quando page/limit não vêm na query', async () => {
      const { dto, errors } = await validateQuery(ListWorkspacesQueryDto, {});
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });

    it('rejeita limit acima do teto (evita dump da tabela inteira)', async () => {
      const { errors } = await validateQuery(ListWorkspacesQueryDto, { page: '1', limit: '999999' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });

    it('rejeita page não numérica (antes virava NaN no OFFSET)', async () => {
      const { errors } = await validateQuery(ListWorkspacesQueryDto, { page: 'abc' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('rejeita page zero ou negativa', async () => {
      const { errors } = await validateQuery(ListWorkspacesQueryDto, { page: '0' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('audit-logs limita o teto de registros por página', async () => {
      const ok = await validateQuery(AuditLogsQueryDto, { page: '2', limit: '200' });
      expect(ok.errors).toHaveLength(0);
      const tooBig = await validateQuery(AuditLogsQueryDto, { limit: '5000' });
      expect(tooBig.errors.length).toBeGreaterThan(0);
    });

    it('audit-logs rejeita workspaceId que não é UUID', async () => {
      const { errors } = await validateQuery(AuditLogsQueryDto, { workspaceId: 'not-a-uuid' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('workspaceId');
    });
  });

  describe('listWorkspaces', () => {
    it('devolve envelope paginado e calcula pages', async () => {
      db.query
        .mockResolvedValueOnce([{ id: 'w1' }])
        .mockResolvedValueOnce([{ total: '42' }]);
      const res = await controller.listWorkspaces({ page: 2, limit: 20 } as ListWorkspacesQueryDto);
      expect(res).toEqual({ items: [{ id: 'w1' }], total: 42, page: 2, limit: 20, pages: 3 });
    });

    it('passa LIMIT/OFFSET como parâmetros, nunca interpolados', async () => {
      db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: '0' }]);
      await controller.listWorkspaces({ page: 3, limit: 10 } as ListWorkspacesQueryDto);
      expect(db.query.mock.calls[0][1]).toEqual([10, 20]);
    });
  });

  describe('getWorkspace', () => {
    it('não expõe settings (jsonb pode guardar credenciais de integração)', async () => {
      db.query.mockResolvedValueOnce([{ id: 'w1' }]);
      await controller.getWorkspace('w1');
      const sql: string = db.query.mock.calls[0][0];
      expect(sql).not.toMatch(/SELECT\s+\*/i);
      expect(sql).not.toContain('settings');
    });

    it('404 quando o workspace não existe', async () => {
      db.query.mockResolvedValueOnce([]);
      await expect(controller.getWorkspace('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getAuditLogs', () => {
    it('junta users por auth_id (audit_logs.user_id guarda o UID do Supabase)', async () => {
      db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: '0' }]);
      await controller.getAuditLogs({ page: 1, limit: 100 } as AuditLogsQueryDto);
      const sql: string = db.query.mock.calls[0][0];
      expect(sql).toContain('u.auth_id = l.user_id');
      expect(sql).not.toMatch(/SELECT\s+\*/i);
    });

    it('aplica filtros como parâmetros posicionais e reaproveita no COUNT', async () => {
      db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: '0' }]);
      await controller.getAuditLogs({
        page: 1, limit: 50, resource: 'patients', userId: undefined,
      } as AuditLogsQueryDto);

      const [itemsSql, itemsParams] = db.query.mock.calls[0];
      const [countSql, countParams] = db.query.mock.calls[1];
      expect(itemsSql).toContain('l.resource = $1');
      expect(itemsParams).toEqual(['patients', 50, 0]);
      expect(countSql).toContain('l.resource = $1');
      expect(countParams).toEqual(['patients']);
    });

    it('sem filtros não gera cláusula WHERE', async () => {
      db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: '7' }]);
      const res = await controller.getAuditLogs({ page: 1, limit: 100 } as AuditLogsQueryDto);
      expect(db.query.mock.calls[0][0]).not.toContain('WHERE');
      expect(res.total).toBe(7);
    });
  });

  describe('adjustTokens', () => {
    it('exige justificativa e limita a magnitude do ajuste', async () => {
      const semReason = await validateQuery(AdjustTokensDto, { amount: 100 });
      expect(semReason.errors.some((e) => e.property === 'reason')).toBe(true);

      const exagerado = await validateQuery(AdjustTokensDto, { amount: 99_999_999, reason: 'x' });
      expect(exagerado.errors.some((e) => e.property === 'amount')).toBe(true);

      const ok = await validateQuery(AdjustTokensDto, { amount: -50, reason: 'estorno de cobrança' });
      expect(ok.errors).toHaveLength(0);
    });

    it('delega ao TokenService com o admin autenticado', async () => {
      const req = { user: { sub: 'admin-sub' } };
      await controller.adjustTokens('ws-1', req, { amount: 100, reason: 'bônus' });
      expect(tokenService.adminAdjust).toHaveBeenCalledWith({
        workspaceId: 'ws-1', amount: 100, reason: 'bônus', adminUserId: 'admin-sub',
      });
    });
  });

  describe('updateTokenCost', () => {
    it('rejeita custo negativo', async () => {
      const { errors } = await validateQuery(UpdateTokenCostDto, { tokensCost: -5 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('404 quando a operação não existe', async () => {
      db.query.mockResolvedValueOnce([]);
      await expect(
        controller.updateTokenCost('inexistente', { tokensCost: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sucesso quando a operação foi atualizada', async () => {
      db.query.mockResolvedValueOnce([{ operation: 'assistant_query' }]);
      await expect(
        controller.updateTokenCost('assistant_query', { tokensCost: 5 }),
      ).resolves.toEqual({ success: true });
    });
  });

  describe('getMetrics', () => {
    it('separa totais de ativos para workspaces e usuários', async () => {
      // O MRR nao consulta mais o banco: `monthly_price_brl` nunca existiu em
      // workspaces, e os meios de pagamento foram retirados da plataforma.
      // Sao 5 consultas agora, nao 6.
      db.query
        .mockResolvedValueOnce([{ total: '47', active: '43' }])
        .mockResolvedValueOnce([{ total: '189', active: '180' }])
        .mockResolvedValueOnce([{ count: '1240' }])
        .mockResolvedValueOnce([{ total: '28750' }])
        .mockResolvedValueOnce([{ operation: 'assistant_query', uses: '10', tokens_consumed: '50' }]);

      const res = await controller.getMetrics();
      expect(res).toMatchObject({
        totalWorkspaces: 47, activeWorkspaces: 43,
        totalUsers: 189, activeUsers: 180,
        totalPatients: 1240, tokensConsumedThisMonth: 28750,
      });
      expect(res.moduleUsage).toHaveLength(1);
    });

    it('MRR vem null, nao zero', async () => {
      // Zero seria lido como "nenhuma receita"; o correto e "nao ha cobranca
      // configurada". A diferenca importa num painel de gestao.
      db.query.mockResolvedValue([{ total: '0', active: '0', count: '0' }]);
      const res = await controller.getMetrics();
      expect(res.mrrBrl).toBeNull();
      expect(res.mrrBrl).not.toBe(0);
    });

    it('nao consulta coluna que nao existe no banco', async () => {
      // Este teste passava antes contra um banco mockado que nao correspondia
      // ao real: a consulta pedia `monthly_price_brl` em workspaces e
      // `deleted_at` em patients, e /admin/metrics devolvia 500 em producao
      // desde sempre. Mock nao substitui exercitar producao.
      db.query
        .mockResolvedValue([{ total: '0', active: '0', count: '0' }]);
      await controller.getMetrics();
      const sqls = db.query.mock.calls.map((c: any[]) => String(c[0]));
      expect(sqls.join(' ')).not.toContain('monthly_price_brl');
      expect(sqls.join(' ')).not.toContain('deleted_at');
    });
  });
});
