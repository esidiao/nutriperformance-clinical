import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { SupervisionService, PAPEL_ESTUDANTE, RECURSOS } from './supervision.service';
import { SupervisionRequest } from './supervision-request.entity';
import { AuditService } from '../audit/audit.service';

const WS = 'ws-1';
const ESTUDANTE = 'estudante-1';
const SUPERVISOR = 'supervisor-1';

const pedido = (over: Partial<SupervisionRequest> = {}): any => ({
  id: 'sup-1', workspaceId: WS, recurso: 'meal_plan', recursoId: 'plan-1',
  estudanteId: ESTUDANTE, supervisorId: null, status: 'pendente',
  parecer: null, decididoEm: null,
  createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe('SupervisionService', () => {
  let svc: SupervisionService;
  let repo: any;
  let audit: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn((d) => d), save: jest.fn(async (d) => ({ id: 'sup-1', ...d })),
      find: jest.fn(async () => []), findOne: jest.fn(async () => null),
      findOneOrFail: jest.fn(async () => ({ id: 'sup-1' })), update: jest.fn(),
      count: jest.fn(async () => 0),
    };
    audit = { log: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        SupervisionService,
        { provide: getRepositoryToken(SupervisionRequest), useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    svc = mod.get(SupervisionService);
  });

  describe('solicitar', () => {
    it('recusa recurso fora da lista', async () => {
      await expect(svc.solicitar(WS, ESTUDANTE, { recurso: 'receita', recursoId: 'x' }))
        .rejects.toThrow(/Recurso inválido/);
    });

    it('exige o id do trabalho', async () => {
      await expect(svc.solicitar(WS, ESTUDANTE, { recurso: 'meal_plan' }))
        .rejects.toThrow(/recursoId/);
    });

    it('nasce pendente e sem supervisor', async () => {
      const p = await svc.solicitar(WS, ESTUDANTE, { recurso: 'meal_plan', recursoId: 'plan-1' });
      expect(p.status).toBe('pendente');
      expect(p.supervisorId).toBeNull();
      expect(p.estudanteId).toBe(ESTUDANTE);
    });

    it('não duplica pedido em aberto', async () => {
      // Dois pedidos para o mesmo trabalho fariam o supervisor decidir a mesma
      // coisa duas vezes.
      repo.findOne.mockResolvedValue(pedido());
      const p = await svc.solicitar(WS, ESTUDANTE, { recurso: 'meal_plan', recursoId: 'plan-1' });
      expect(p.id).toBe('sup-1');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('decidir', () => {
    beforeEach(() => repo.findOne.mockResolvedValue(pedido()));

    it('ninguém supervisiona o próprio trabalho', async () => {
      // Autoaprovação esvaziaria o estágio: o registro diria que houve revisão
      // onde não houve.
      await expect(svc.decidir(WS, ESTUDANTE, 'sup-1', { status: 'aprovado' }))
        .rejects.toThrow(ForbiddenException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('aprova e registra quem decidiu e quando', async () => {
      await svc.decidir(WS, SUPERVISOR, 'sup-1', { status: 'aprovado' });
      const [, mudancas] = repo.update.mock.calls[0];
      expect(mudancas.status).toBe('aprovado');
      expect(mudancas.supervisorId).toBe(SUPERVISOR);
      expect(mudancas.decididoEm).toBeInstanceOf(Date);
    });

    it('pedir ajustes exige parecer', async () => {
      // "Ajustes solicitados" sem dizer quais não ensina nada.
      await expect(svc.decidir(WS, SUPERVISOR, 'sup-1', { status: 'ajustes_solicitados' }))
        .rejects.toThrow(/não\s+ensina|ajustado/i);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('aceita ajustes com parecer', async () => {
      await svc.decidir(WS, SUPERVISOR, 'sup-1', {
        status: 'ajustes_solicitados', parecer: 'Revisar a distribuição de carboidratos.',
      });
      const [, mudancas] = repo.update.mock.calls[0];
      expect(mudancas.parecer).toBe('Revisar a distribuição de carboidratos.');
    });

    it('recusa decisão inventada', async () => {
      await expect(svc.decidir(WS, SUPERVISOR, 'sup-1', { status: 'talvez' }))
        .rejects.toThrow(BadRequestException);
    });

    it('não decide duas vezes', async () => {
      repo.findOne.mockResolvedValue(pedido({ status: 'aprovado' }));
      await expect(svc.decidir(WS, SUPERVISOR, 'sup-1', { status: 'aprovado' }))
        .rejects.toThrow(/já foi decidido/);
    });

    it('404 para pedido de outro workspace', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.decidir(WS, SUPERVISOR, 'x', { status: 'aprovado' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── O que realmente protege o paciente ────────────────────────────────────
  describe('aprovacaoValida', () => {
    const agora = new Date();
    const antes = new Date(agora.getTime() - 3600_000);
    const depois = new Date(agora.getTime() + 3600_000);

    it('sem pedido, não libera', async () => {
      repo.findOne.mockResolvedValue(null);
      const r = await svc.aprovacaoValida(WS, 'meal_plan', 'plan-1', agora);
      expect(r.liberado).toBe(false);
      expect(r.motivo).toMatch(/não foi enviado/);
    });

    it('pendente, não libera', async () => {
      repo.findOne.mockResolvedValue(pedido());
      const r = await svc.aprovacaoValida(WS, 'meal_plan', 'plan-1', agora);
      expect(r.liberado).toBe(false);
      expect(r.motivo).toMatch(/Aguardando/);
    });

    it('ajustes solicitados, não libera e mostra o parecer', async () => {
      repo.findOne.mockResolvedValue(pedido({
        status: 'ajustes_solicitados', parecer: 'Faltou fibra', decididoEm: antes,
      }));
      const r = await svc.aprovacaoValida(WS, 'meal_plan', 'plan-1', antes);
      expect(r.liberado).toBe(false);
      expect(r.motivo).toContain('Faltou fibra');
    });

    it('aprovado e intacto, libera', async () => {
      repo.findOne.mockResolvedValue(pedido({ status: 'aprovado', decididoEm: agora }));
      const r = await svc.aprovacaoValida(WS, 'meal_plan', 'plan-1', antes);
      expect(r.liberado).toBe(true);
    });

    it('EDITADO depois da aprovação, não libera', async () => {
      // Este é o caminho óbvio para burlar: mandar uma versão simples, ser
      // aprovado, e trocar o conteúdo antes de entregar. O supervisor teria
      // aprovado outra coisa.
      repo.findOne.mockResolvedValue(pedido({ status: 'aprovado', decididoEm: agora }));
      const r = await svc.aprovacaoValida(WS, 'meal_plan', 'plan-1', depois);
      expect(r.liberado).toBe(false);
      expect(r.motivo).toMatch(/alterado depois da aprovação/);
    });
  });

  describe('constantes', () => {
    it('o papel supervisionado é o que existe no enum de usuários', () => {
      expect(PAPEL_ESTUDANTE).toBe('supervised_student');
    });

    it('cobre os trabalhos que chegam ao paciente', () => {
      expect(RECURSOS).toContain('meal_plan');
    });
  });
});
