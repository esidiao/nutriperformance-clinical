import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, GoneException } from '@nestjs/common';
import { PatientPortalService, hashToken, gerarToken } from './patient-portal.service';
import { PatientPortalLink } from './patient-portal-link.entity';
import { AuditService } from '../audit/audit.service';
import { PatientsService } from '../patients/patients.service';
import { MealPlansService } from '../meal-plans/meal-plans.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { FoodDiaryService } from '../food-diary/food-diary.service';

const WS = 'ws-1';
const USER = 'user-1';
const PACIENTE = 'paciente-1';
const TOKEN = 't'.repeat(43);

const link = (over: Partial<PatientPortalLink> = {}): any => ({
  id: 'pl-1', workspaceId: WS, patientId: PACIENTE, createdBy: USER,
  tokenHash: hashToken(TOKEN), status: 'ativo',
  expiraEm: new Date(Date.now() + 864e5), ultimoAcessoEm: null,
  createdAt: new Date(), updatedAt: new Date(), ...over,
});

const planoPublicado = {
  id: 'plan-1', nome: 'Plano de manutenção', isDraft: false, isTemplate: false,
};

describe('PatientPortalService', () => {
  let svc: PatientPortalService;
  let repo: any;
  let audit: any;
  let patients: any;
  let mealPlans: any;
  let appointments: any;
  let diary: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn((d) => d), save: jest.fn(async (d) => ({ id: 'pl-1', ...d })),
      find: jest.fn(async () => []), findOne: jest.fn(async () => null),
      findOneOrFail: jest.fn(async () => ({ id: 'pl-1' })), update: jest.fn(),
    };
    audit = { log: jest.fn() };
    patients = { findById: jest.fn(async () => ({ name: 'Maria de Souza Oliveira' })) };
    mealPlans = {
      findByPatient: jest.fn(async () => [planoPublicado]),
      findOne: jest.fn(async () => ({
        ...planoPublicado,
        objetivo: 'Manutenção de peso',
        orientacoesGerais: 'Beber 2 litros de água por dia',
        observacoes: 'ANOTACAO CLINICA INTERNA sobre a paciente',
        metaKcal: 1800,
        refeicoes: [{ refeicao: 'almoco', itens: [] }],
        totais: { kcal: 1750 },
      })),
    };
    // `paraPortal` e nao `listar`: o filtro do link de video pela janela de
    // tempo mora no servico da agenda, e o portal delega.
    appointments = { paraPortal: jest.fn(async () => []) };
    diary = {
      listarRegistros: jest.fn(async () => ({ registros: [], adesao: {} })),
      registrarPorPortal: jest.fn(async () => ({ id: 'e-1', envio: null })),
    };

    const mod = await Test.createTestingModule({
      providers: [
        PatientPortalService,
        { provide: getRepositoryToken(PatientPortalLink), useValue: repo },
        { provide: AuditService, useValue: audit },
        { provide: PatientsService, useValue: patients },
        { provide: MealPlansService, useValue: mealPlans },
        { provide: AppointmentsService, useValue: appointments },
        { provide: FoodDiaryService, useValue: diary },
      ],
    }).compile();
    svc = mod.get(PatientPortalService);
  });

  describe('criarLink', () => {
    it('guarda hash, nunca o token', async () => {
      const { link: l, token } = await svc.criarLink(WS, USER, { patientId: PACIENTE });
      expect(l.tokenHash).toBe(hashToken(token));
      expect(JSON.stringify(l)).not.toContain(token);
    });

    it('validade padrão de 90 dias', async () => {
      const { link: l } = await svc.criarLink(WS, USER, { patientId: PACIENTE });
      const dias = Math.round((new Date(l.expiraEm).getTime() - Date.now()) / 864e5);
      expect(dias).toBe(90);
    });

    it('recusa validade acima do teto', async () => {
      await expect(svc.criarLink(WS, USER, { patientId: PACIENTE, diasValidade: 365 }))
        .rejects.toThrow(/conteúdo clínico/);
    });

    it('exige paciente', async () => {
      await expect(svc.criarLink(WS, USER, {})).rejects.toThrow(/patientId/);
    });

    it('token não se repete e é seguro para URL', () => {
      const t = new Set(Array.from({ length: 200 }, () => gerarToken()));
      expect(t.size).toBe(200);
      for (const x of t) expect(x).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('abrirPortal', () => {
    beforeEach(() => repo.findOne.mockResolvedValue(link()));

    it('token curto nem chega ao banco', async () => {
      repo.findOne.mockClear();
      await expect(svc.abrirPortal('abc')).rejects.toThrow(NotFoundException);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('revogado responde igual a inexistente', async () => {
      repo.findOne.mockResolvedValue(link({ status: 'revogado' }));
      const revogado = await svc.abrirPortal(TOKEN).catch((e) => e);
      repo.findOne.mockResolvedValue(null);
      const inexistente = await svc.abrirPortal(TOKEN).catch((e) => e);
      expect(revogado.constructor).toBe(inexistente.constructor);
      expect(revogado.message).toBe(inexistente.message);
    });

    it('expirado avisa com clareza', async () => {
      repo.findOne.mockResolvedValue(link({ expiraEm: new Date(Date.now() - 1000) }));
      await expect(svc.abrirPortal(TOKEN)).rejects.toThrow(GoneException);
    });

    // ── O que NÃO pode chegar ao paciente ──────────────────────────────────
    it('NÃO mostra plano em rascunho', async () => {
      // Rascunho é trabalho em andamento. Um paciente que abrisse um plano pela
      // metade seguiria um plano pela metade.
      mealPlans.findByPatient.mockResolvedValue([{ ...planoPublicado, isDraft: true }]);
      const r: any = await svc.abrirPortal(TOKEN);
      expect(r.plano).toBeNull();
    });

    it('NÃO mostra modelo como se fosse plano do paciente', async () => {
      mealPlans.findByPatient.mockResolvedValue([
        { ...planoPublicado, isTemplate: true },
      ]);
      const r: any = await svc.abrirPortal(TOKEN);
      expect(r.plano).toBeNull();
    });

    it('NÃO vaza as observações internas do plano', async () => {
      // Na dúvida sobre para quem um texto foi escrito, ele não vai ao paciente.
      const r: any = await svc.abrirPortal(TOKEN);
      expect(JSON.stringify(r)).not.toContain('ANOTACAO CLINICA INTERNA');
    });

    it('mostra as orientações gerais, que são para o paciente', async () => {
      const r: any = await svc.abrirPortal(TOKEN);
      expect(r.plano.orientacoesGerais).toBe('Beber 2 litros de água por dia');
    });

    it('NÃO mostra a meta calórica', async () => {
      // Número de meta sem o contexto da consulta vira alvo, e alvo vira
      // cobrança.
      const r: any = await svc.abrirPortal(TOKEN);
      expect(r.plano.metaKcal).toBeUndefined();
    });

    it('mostra só o PRIMEIRO nome', async () => {
      const r: any = await svc.abrirPortal(TOKEN);
      expect(r.primeiroNome).toBe('Maria');
      expect(JSON.stringify(r)).not.toContain('Souza');
    });

    it('NÃO vaza o comentário da profissional no diário', async () => {
      diary.listarRegistros.mockResolvedValue({
        registros: [{
          id: 'e-1', refeicao: 'almoco', descricao: 'Arroz',
          tomadaEm: new Date(), fotoUrl: null,
          comentario: 'EXCESSO DE CARBOIDRATO',
        }],
        adesao: {},
      });
      const r: any = await svc.abrirPortal(TOKEN);
      expect(JSON.stringify(r)).not.toContain('EXCESSO DE CARBOIDRATO');
      expect(r.diario[0]).not.toHaveProperty('comentario');
    });

    it('delega as consultas ao servico da agenda', async () => {
      // O filtro do link de video pela janela de tempo mora la. Montar a lista
      // aqui repetiria a regra, e a copia esquecida entregaria a sala semanas
      // antes da consulta.
      appointments.paraPortal.mockResolvedValue([
        { inicio: new Date(), fim: new Date(), tipo: 'online', status: 'agendada',
          linkVideo: null, temSalaMarcada: true },
      ]);
      const r: any = await svc.abrirPortal(TOKEN);
      expect(appointments.paraPortal).toHaveBeenCalledWith(
        WS, PACIENTE, expect.any(String), expect.any(String),
      );
      expect(r.consultas).toHaveLength(1);
    });

    it('registra o acesso na trilha de LGPD', async () => {
      // Dado sensível lido por fora do sistema precisa aparecer na trilha.
      await svc.abrirPortal(TOKEN);
      expect(patients.findById).toHaveBeenCalledWith(
        PACIENTE, 'paciente-via-portal', WS, expect.anything(),
      );
    });

    it('anota o último acesso', async () => {
      await svc.abrirPortal(TOKEN);
      expect(repo.update).toHaveBeenCalledWith('pl-1', expect.objectContaining({
        ultimoAcessoEm: expect.any(Date),
      }));
    });
  });

  describe('registrarRefeicao', () => {
    it('delega ao diário em vez de reimplementar as regras', async () => {
      // Duplicadas, as duas cópias divergiriam na primeira mudança, e a que
      // ficasse para trás aceitaria o que a outra recusa.
      repo.findOne.mockResolvedValue(link());
      await svc.registrarRefeicao(TOKEN, { refeicao: 'almoco', descricao: 'Salada' });
      expect(diary.registrarPorPortal).toHaveBeenCalledWith(
        WS, PACIENTE, expect.objectContaining({ refeicao: 'almoco' }),
      );
    });

    it('link revogado não registra nada', async () => {
      repo.findOne.mockResolvedValue(link({ status: 'revogado' }));
      await expect(svc.registrarRefeicao(TOKEN, { refeicao: 'almoco', descricao: 'x' }))
        .rejects.toThrow(NotFoundException);
      expect(diary.registrarPorPortal).not.toHaveBeenCalled();
    });
  });
});
